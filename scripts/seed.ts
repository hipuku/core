/**
 * Seed a workspace with a decision log that has actually been used.
 *
 * Two jobs, one script. It populates the public demo, and it gives anyone who
 * clones this repo something to look at — an empty decision log demonstrates
 * nothing, and "sign up, create a workspace, write three ADRs" is not a
 * reasonable ask of someone evaluating the project.
 *
 *   npm run db:seed
 *
 * Idempotent by workspace name: re-running replaces the seeded workspace rather
 * than stacking duplicates. It never touches anything it did not create.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable, workspaces } from "@/lib/db/schema";
import { decisionService } from "@/lib/decisions";

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@core.hipuku.dev";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "read-only-demo-2026";
const DEMO_NAME = "Demo";
const WORKSPACE_NAME = "Vault";

/** A second member, so the permission story is visible rather than described. */
const AUTHOR_EMAIL = "author@core.hipuku.dev";
const AUTHOR_PASSWORD = "read-only-demo-2026";

function log(step: string) {
  console.log(`  ${step}`);
}

/**
 * better-auth owns password hashing, so accounts are created through its own
 * sign-up path rather than by inserting rows. An existing account is reused —
 * re-seeding must not fail because the demo user is already there.
 */
async function ensureUser(email: string, password: string, name: string) {
  const [existing] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (existing) {
    log(`user ${email} already exists`);
    return existing.id;
  }

  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  });
  log(`created user ${email}`);
  return result.user.id;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Fill it in .env.local first.");
  }

  console.log("Seeding…");

  const demoId = await ensureUser(DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME);
  const authorId = await ensureUser(AUTHOR_EMAIL, AUTHOR_PASSWORD, "Priya");

  // Replace rather than append: cascades clear the decisions, documents,
  // transitions and references belonging to the old copy.
  const [stale] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.name, WORKSPACE_NAME))
    .limit(1);
  if (stale) {
    await db.delete(workspaces).where(eq(workspaces.id, stale.id));
    log(`removed the previous "${WORKSPACE_NAME}" workspace`);
  }

  const workspace = await decisionService.createWorkspace(demoId, WORKSPACE_NAME);
  await decisionService.addMember(workspace.id, authorId, "author");
  log(`workspace ${workspace.key} — ${workspace.name}`);

  /* ---- VAU-001: accepted, then superseded ------------------------------- */
  const tokens = await decisionService.propose(workspace.id, demoId, {
    title: "Ship design tokens as CSS custom properties",
    body: {
      context:
        "The palette lives in three places — a Figma file, a Sass map, and a " +
        "hand-maintained TypeScript object. They disagree, and the one people " +
        "actually read is whichever they found first.\n\n" +
        "We need a single definition that both the app and the design tooling " +
        "can consume without a build step in between.",
      decision:
        "Publish the palette as **CSS custom properties**, generated from one " +
        "source file.\n\n" +
        "- Primitives and semantics stay in separate layers; no component " +
        "references a primitive directly.\n" +
        "- The generated file is committed, so a consumer needs no toolchain.",
      consequences:
        "Easier: theming, because a custom property can be overridden per " +
        "subtree. Harder: any consumer that needs values at build time, which " +
        "now has to parse CSS or import the source.\n\n" +
        "We accept that trade: runtime theming is the case we actually have.",
    },
  });
  await decisionService.changeStatus(tokens.id, demoId, "accepted");
  log("VAU-001 proposed and accepted");

  /* ---- VAU-002: accepted, supersedes 001 -------------------------------- */
  const oklch = await decisionService.propose(workspace.id, demoId, {
    title: "Move the palette to OKLCH",
    body: {
      context:
        "Since VAU-001 shipped, two problems have surfaced. Our hex ramps are " +
        "not perceptually even — the 400 and 500 steps look identical in the " +
        "blues and miles apart in the yellows. And `getComputedStyle` now " +
        "returns `oklch()` verbatim in every current browser, so tooling that " +
        "assumed `rgb()` reads our colours as null.",
      decision:
        "Define every colour in **OKLCH**, keeping the custom-property " +
        "delivery from VAU-001 unchanged.\n\n" +
        "```mermaid\ngraph LR\n  A[OKLCH source] --> B[primitives.css]\n  " +
        "B --> C[semantics.css]\n  C --> D[Components]\n```",
      consequences:
        "Easier: even ramps, and lightness that means what it says. Harder: " +
        "anyone reading colours out of the DOM must parse OKLCH — a real " +
        "migration for our contrast checker.\n\n" +
        "This supersedes VAU-001 rather than revising it: the delivery " +
        "mechanism was right, the colour space was not.",
    },
  });
  await decisionService.changeStatus(oklch.id, demoId, "accepted");
  await decisionService.supersede(oklch.id, tokens.id, demoId);
  log("VAU-002 accepted, superseding VAU-001");

  /* ---- VAU-003: proposed, awaiting review, with a revision -------------- */
  const queue = await decisionService.propose(workspace.id, authorId, {
    title: "Use Redis and BullMQ for the crawl queue",
    body: {
      context:
        "Crawls take minutes and must survive a deploy. Running them in the " +
        "request is already causing timeouts.",
      decision: "Queue crawl jobs in BullMQ over Redis.",
      consequences: "Adds an operational dependency we do not have today.",
    },
  });
  await decisionService.revise(queue.id, authorId, {
    context:
      "Crawls take minutes and must survive a deploy. Running them in the " +
      "request is already causing timeouts, and a redeploy mid-crawl loses the " +
      "work with no way to resume.",
    decision:
      "Queue crawl jobs in **BullMQ** over Redis.\n\n" +
      "Considered and rejected: a database-backed queue (polling costs more " +
      "than it saves at our job rate) and a managed queue (a second vendor for " +
      "one feature).",
    consequences:
      "Adds an operational dependency we do not have today. In exchange we get " +
      "retries, backoff and resumability for free rather than building them.\n\n" +
      "Open question for review: do we run Redis ourselves or take a managed " +
      "instance? This decision does not settle that.",
  });
  log("VAU-003 proposed by an author, then revised — awaiting review");

  /* ---- VAU-004: rejected ------------------------------------------------ */
  const monorepo = await decisionService.propose(workspace.id, authorId, {
    title: "Move every package into one monorepo",
    body: {
      context:
        "Six repositories, three of which depend on the design system. A " +
        "token change means three pull requests in sequence.",
      decision: "Consolidate all six repositories into a single monorepo.",
      consequences:
        "Easier: atomic cross-package changes. Harder: everything else — CI " +
        "matrices, release tagging, and the independence that lets one project " +
        "deliberately not consume the design system.",
    },
  });
  await decisionService.changeStatus(
    monorepo.id,
    demoId,
    "rejected",
    "The coupling is the thing we want, and a monorepo makes it invisible. " +
      "Revisit if the release friction gets worse.",
  );
  log("VAU-004 rejected, with a reason");

  /* ---- VAU-005: accepted, deprecated ------------------------------------ */
  const enzyme = await decisionService.propose(workspace.id, demoId, {
    title: "Standardise on Enzyme for component tests",
    body: {
      context: "Three test styles across the codebase and no house rule.",
      decision: "Use Enzyme for all component tests.",
      consequences: "One idiom to learn. Shallow rendering keeps tests fast.",
    },
  });
  await decisionService.changeStatus(enzyme.id, demoId, "accepted");
  await decisionService.changeStatus(
    enzyme.id,
    demoId,
    "deprecated",
    "Enzyme has no React 18 adapter. Testing Library is what we use now; this " +
      "record stays for the reasoning, not the instruction.",
  );
  log("VAU-005 accepted, then deprecated");

  /* ---- a drifted reference ---------------------------------------------
     Seeded rather than fetched: the point is that staleness is *visible*
     without anyone having to connect a GitHub account first. */
  const drifted = await decisionService.addReference(oklch.id, demoId, {
    kind: "file",
    label: "hipuku/haus · packages/tokens/src/primitives.css · L1-L48",
    url: "https://github.com/hipuku/haus/blob/main/packages/tokens/src/primitives.css#L1-L48",
    repo: "hipuku/haus",
    path: "packages/tokens/src/primitives.css",
    startLine: 1,
    endLine: 48,
    baselineSnippet: ":root {\n  --aronia-850: oklch(0.32 0.05 320);\n}",
    baselineSha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  });
  // A different SHA from the baseline: the cited code has moved on.
  await decisionService.recordReferenceState(
    drifted.id,
    demoId,
    "0f1e2d3c4b5a6978879665544332211000ffeedd",
  );
  await decisionService.addReference(queue.id, authorId, {
    kind: "file",
    label: "hipuku/drift · src/queue/crawl.ts",
    url: "https://github.com/hipuku/drift/blob/main/src/queue/crawl.ts",
    repo: "hipuku/drift",
    path: "src/queue/crawl.ts",
    baselineSha: "1122334455667788990011223344556677889900",
  });
  log("cited two files — one of them drifted");

  console.log("\nDone.");
  console.log(`  workspace : ${workspace.key} — ${workspace.name}`);
  console.log(`  sign in as: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  author    : ${AUTHOR_EMAIL} / ${AUTHOR_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
