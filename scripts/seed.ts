/**
 * Seed a workspace with a decision log that has actually been used.
 *
 * Two jobs, one script. It populates the public demo, and it gives anyone who
 * clones this repo something to look at. An empty decision log demonstrates
 * nothing, and "sign up, create a workspace, write three ADRs" is not a
 * reasonable ask of someone evaluating the project.
 *
 *   npm run db:seed
 *
 * Idempotent by workspace name: re-running replaces the seeded workspace rather
 * than stacking duplicates. It never touches anything it did not create.
 */

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
 * sign-up path rather than by inserting rows. An existing account is reused:
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
  log(`workspace ${workspace.key}: ${workspace.name}`);

  // Connected first, and this matters: an inline `{{owner/repo:path}}` citation
  // only renders as a file chip when its repo is connected to the workspace.
  // Without these the tokens below fall back to plain code, which is the
  // graceful degradation working correctly and looking like a bug.
  for (const repo of [
    { owner: "hipuku", name: "vault", defaultBranch: "main" },
    { owner: "hipuku", name: "haus", defaultBranch: "main" },
  ]) {
    await decisionService.connectRepo(workspace.id, demoId, repo);
  }
  log("connected hipuku/vault and hipuku/haus");

  /* ---- VAU-001: accepted, then superseded ------------------------------- */
  const tokens = await decisionService.propose(workspace.id, demoId, {
    title: "Ship design tokens as CSS custom properties",
    body: {
      context:
        "The palette lives in three places: a Figma file, a Sass map, and a " +
        "hand-maintained TypeScript object. They disagree, and the one people " +
        "actually read is whichever they found first.\n\n" +
        "We need a single definition that both the app and the design tooling " +
        "can consume without a build step in between.",
      decision:
        "Publish the palette as **CSS custom properties**, generated from one " +
        "source file, {{hipuku/haus:packages/tokens/src/tokens.json}}.\n\n" +
        "1. Primitives and semantics stay in separate layers; no component " +
        "references a primitive directly.\n" +
        "2. The generated file is committed, so a consumer needs no toolchain.\n" +
        "3. `haus-tokens` ships the CSS; nothing else ships colour.",
      consequences:
        "Easier: theming, because a custom property can be overridden per " +
        "subtree. Harder: any consumer that needs values at build time, which " +
        "now has to parse CSS or import the source.\n\n" +
        "We accept that trade: runtime theming is the case we actually have.",
    },
  });
  await decisionService.changeStatus(tokens.id, demoId, "accepted");
  log("VAU-001 proposed and accepted");

  /* ---- VAU-002: accepted, supersedes 001 --------------------------------
     The showcase record: headings, a table, a task list, a blockquote, inline
     code, a fenced block, and inline file citations that resolve to the repos
     connected above. */
  const oklch = await decisionService.propose(workspace.id, demoId, {
    title: "Move the palette to OKLCH",
    body: {
      context:
        "Since VAU-001 shipped, two problems have surfaced.\n\n" +
        "**The ramps are not perceptually even.** Our 400 and 500 steps look " +
        "identical in the blues and miles apart in the yellows, because hex " +
        "lightness is not lightness.\n\n" +
        "**And the tooling reads our colours as null.** " +
        "`getComputedStyle` returns `oklch()` verbatim in every current " +
        "browser, and both halves of our contrast probe assume `rgb()`. See " +
        "{{hipuku/drift:src/probe/colour.ts#L34-L61}}, which falls through to " +
        "the page canvas when a colour fails to parse and so measures contrast " +
        "against the wrong background.\n\n" +
        "> This is a live bug for any modern OKLCH site, not just ours.\n\n" +
        "| Colour space | Even ramps | Readable from the DOM | Browser support |\n" +
        "|---|---|---|---|\n" +
        "| hex / `rgb()` | no | yes | universal |\n" +
        "| HSL | no | yes | universal |\n" +
        "| **OKLCH** | **yes** | needs a parser | all current browsers |",
      decision:
        "Define every colour in **OKLCH**, keeping the custom-property " +
        "delivery from VAU-001 unchanged.\n\n" +
        "The primitive layer holds the raw ramps and the semantic layer names " +
        "them; no component references a primitive directly. The generated " +
        "files are {{hipuku/haus:packages/tokens/src/primitives.css#L1-L48}} " +
        "and {{hipuku/haus:packages/tokens/src/semantics.css}}.\n\n" +
        "```mermaid\n" +
        "graph TD\n" +
        "  subgraph source[Source of truth]\n" +
        "    F[Figma variables]\n" +
        "    T[tokens.json]\n" +
        "  end\n" +
        "  subgraph build[Generated, committed]\n" +
        "    P[primitives.css<br/>raw OKLCH ramps]\n" +
        "    S[semantics.css<br/>named roles]\n" +
        "    M[motion.css]\n" +
        "  end\n" +
        "  subgraph consume[Consumers]\n" +
        "    C[haus-components]\n" +
        "    A[Applications]\n" +
        "    D[drift crawler]\n" +
        "  end\n" +
        "  F -->|export| T\n" +
        "  T -->|generate| P\n" +
        "  P --> S\n" +
        "  T -->|generate| M\n" +
        "  S --> C\n" +
        "  S --> A\n" +
        "  C --> A\n" +
        "  A -.->|getComputedStyle| D\n" +
        "  D -.->|reports drift| T\n" +
        "  classDef gen fill:#eef2ff,stroke:#4f46e5\n" +
        "  class P,S,M gen\n" +
        "```\n\n" +
        "Migration, in order:\n\n" +
        "- [x] Convert the primitive ramps\n" +
        "- [x] Re-point the semantic layer\n" +
        "- [ ] Teach the contrast probe to parse OKLCH\n" +
        "- [ ] Re-baseline the visual regression snapshots",
      consequences:
        "**Easier.** Even ramps, and lightness that means what it says. " +
        "Theming stays a custom-property override, exactly as before.\n\n" +
        "**Harder.** Anything reading colours out of the DOM has to parse " +
        "OKLCH. That is a real migration for the contrast checker, and the " +
        "reason the last two boxes above are unticked.\n\n" +
        "```ts\n" +
        "// The shape every consumer now needs\n" +
        "import { toHex } from \"haus-colour-utils\";\n" +
        "\n" +
        "const measured = getComputedStyle(el).color; // 'oklch(0.52 0.138 300)'\n" +
        "const hex = toHex(measured);                 // '#7c5cbf'\n" +
        "```\n\n" +
        "This **supersedes VAU-001** rather than revising it: the delivery " +
        "mechanism was right, the colour space was not.",
    },
  });
  await decisionService.changeStatus(oklch.id, demoId, "accepted");
  await decisionService.supersede(oklch.id, tokens.id, demoId);
  log("VAU-002 accepted, superseding VAU-001");

  /* ---- VAU-003: proposed, revised twice, awaiting review ---------------- */
  const culori = await decisionService.propose(workspace.id, authorId, {
    title: "Keep vault's colour maths on culori, not haus-colour-utils",
    body: {
      context:
        "vault does its own conversion, contrast and harmony maths through " +
        "culori. haus now publishes `haus-colour-utils`, and the obvious tidy-up " +
        "is to have vault consume it.",
      decision: "Keep culori. Do not adopt haus-colour-utils in vault.",
      consequences: "Two implementations of the same maths, maintained separately.",
    },
  });
  await decisionService.revise(culori.id, authorId, {
    context:
      "vault does its own conversion, contrast and harmony maths through " +
      "culori; see {{hipuku/vault:src/colour/convert.ts#L1-L64}}. haus now " +
      "publishes `haus-colour-utils`, and the obvious tidy-up is to have vault " +
      "consume it.\n\n" +
      "The pull is real: the OKLCH parsing bug in VAU-002 was fixed once, in " +
      "{{hipuku/haus:packages/colour-utils/src/toHex.ts}}, and vault would have " +
      "had it for free.\n\n" +
      "> The question is not whether sharing is cheaper. It is what vault is " +
      "> for.",
    decision:
      "**Keep culori. Do not adopt `haus-colour-utils` in vault.**\n\n" +
      "vault is the one shipped product in the portfolio, and its value as a " +
      "reference is that it stands alone. Coupling it to a design system still " +
      "under active development would make it a demo of that system instead.\n\n" +
      "```mermaid\n" +
      "graph LR\n" +
      "  subgraph ds[Design system]\n" +
      "    T[haus-tokens]\n" +
      "    U[haus-colour-utils]\n" +
      "    C[haus-components]\n" +
      "  end\n" +
      "  subgraph apps[Applications]\n" +
      "    L[loom<br/>consumes haus]\n" +
      "    V[vault<br/>stands alone]\n" +
      "  end\n" +
      "  T --> C\n" +
      "  U --> C\n" +
      "  C --> L\n" +
      "  T --> L\n" +
      "  V -->|culori| X[Own colour maths]\n" +
      "  U -.->|deliberately not| V\n" +
      "  linkStyle 5 stroke:#c2410c,stroke-dasharray:4\n" +
      "```\n\n" +
      "What we will do instead:\n\n" +
      "- [x] Document the decoupling in vault's DESIGN.md\n" +
      "- [x] Port the OKLCH parsing fix by hand\n" +
      "- [ ] Add a test in vault pinning the conversion results\n" +
      "- [ ] Revisit if a third consumer appears",
    consequences:
      "**Accepted cost.** Two implementations of the same maths, maintained " +
      "separately. A fix in one has to be carried to the other by hand, which " +
      "we have already done once.\n\n" +
      "| | Adopt haus-colour-utils | Keep culori |\n" +
      "|---|---|---|\n" +
      "| Fixes shared | yes | by hand |\n" +
      "| vault independent of a moving library | no | **yes** |\n" +
      "| Bundle size | smaller | larger |\n" +
      "| Demonstrates | consistency | range |\n\n" +
      "**Open for review:** the last row is the whole argument, and it is a " +
      "judgement rather than a measurement. Push back on it.",
  });
  log("VAU-003 proposed by an author, then revised, awaiting review");

  /* ---- VAU-004: rejected ------------------------------------------------ */
  const signing = await decisionService.propose(workspace.id, authorId, {
    title: "Ship signed and notarised macOS installers",
    body: {
      context:
        "vault ships unsigned `.dmg` builds for Apple silicon and Intel. On " +
        "first launch macOS refuses to open them until the user right-clicks " +
        "and confirms, which reads as broken to anyone who has not seen it " +
        "before.",
      decision:
        "Join the Apple Developer Program and sign and notarise every release " +
        "in {{hipuku/vault:.github/workflows/release.yml}}.",
      consequences:
        "Easier: installation stops looking like a warning. Harder: an annual " +
        "fee, credentials in CI, and a notarisation step that can fail a " +
        "release for reasons unrelated to the code.",
    },
  });
  await decisionService.changeStatus(
    signing.id,
    demoId,
    "rejected",
    "Unsigned is a documented, deliberate choice for a portfolio app. The " +
      "README explains the right-click, and the reasoning is itself part of " +
      "what the project demonstrates. Revisit if vault ever has users who did " +
      "not arrive via the repo.",
  );
  log("VAU-004 rejected, with a reason");

  /* ---- VAU-005: accepted, then deprecated ------------------------------- */
  const store = await decisionService.propose(workspace.id, demoId, {
    title: "Persist vault preferences with electron-store",
    body: {
      context:
        "Window size, the last palette and the export format need to survive a " +
        "restart. Writing them by hand means picking a location per platform " +
        "and handling a corrupted file.",
      decision:
        "Use `electron-store` for all persisted preferences.",
      consequences:
        "One dependency, sensible defaults per platform, and atomic writes. " +
        "Preferences become JSON on disk that a user can edit or delete.",
    },
  });
  await decisionService.changeStatus(store.id, demoId, "accepted");
  await decisionService.changeStatus(
    store.id,
    demoId,
    "deprecated",
    "Superseded in practice rather than by a decision: preferences moved into " +
      "the renderer's own storage when the app became single-window. The " +
      "record stays for the reasoning, not the instruction.",
  );
  log("VAU-005 accepted, then deprecated");

  /* ---- references -------------------------------------------------------
     Every file cited inline is also attached as a reference, so the chips in
     the prose and the list at the bottom agree. They are separate concepts, in
     that a citation is an argument and a reference is a tracked artifact with a
     baseline, but a reader seeing one without the other just sees an
     inconsistency. */

  // The cited range, and the one that has drifted since VAU-002 was accepted.
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

  await decisionService.addReference(oklch.id, demoId, {
    kind: "file",
    label: "hipuku/haus · packages/tokens/src/semantics.css",
    url: "https://github.com/hipuku/haus/blob/main/packages/tokens/src/semantics.css",
    repo: "hipuku/haus",
    path: "packages/tokens/src/semantics.css",
    baselineSha: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
  });

  await decisionService.addReference(tokens.id, demoId, {
    kind: "file",
    label: "hipuku/haus · packages/tokens/src/tokens.json",
    url: "https://github.com/hipuku/haus/blob/main/packages/tokens/src/tokens.json",
    repo: "hipuku/haus",
    path: "packages/tokens/src/tokens.json",
    baselineSha: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
  });

  await decisionService.addReference(culori.id, authorId, {
    kind: "file",
    label: "hipuku/vault · src/colour/convert.ts · L1-L64",
    url: "https://github.com/hipuku/vault/blob/main/src/colour/convert.ts#L1-L64",
    repo: "hipuku/vault",
    path: "src/colour/convert.ts",
    startLine: 1,
    endLine: 64,
    baselineSnippet: 'import { converter, formatHex } from "culori";',
    baselineSha: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
  });

  await decisionService.addReference(culori.id, authorId, {
    kind: "file",
    label: "hipuku/haus · packages/colour-utils/src/toHex.ts",
    url: "https://github.com/hipuku/haus/blob/main/packages/colour-utils/src/toHex.ts",
    repo: "hipuku/haus",
    path: "packages/colour-utils/src/toHex.ts",
    baselineSha: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4",
  });

  await decisionService.addReference(signing.id, authorId, {
    kind: "file",
    label: "hipuku/vault · .github/workflows/release.yml",
    url: "https://github.com/hipuku/vault/blob/main/.github/workflows/release.yml",
    repo: "hipuku/vault",
    path: ".github/workflows/release.yml",
    baselineSha: "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5",
  });
  log("attached six file references, one of them drifted");

  /* ---- a link reference, so both kinds are visible ---------------------- */
  await decisionService.addReference(culori.id, authorId, {
    kind: "link",
    label: "culori: colour space conversion",
    url: "https://culorijs.org/api/",
  });
  log("attached a link reference alongside the file ones");

  /* ---- a parked draft ---------------------------------------------------
     So the drafts zone is not empty on arrival, and the difference between a
     draft and a decision (no number, a Draft tag, private to its author) is
     visible rather than described. */
  await decisionService.saveDraft(workspace.id, demoId, {
    title: "Adopt a component visual-regression suite",
    body: {
      context:
        "Three token migrations have each broken something visually that no " +
        "unit test could have caught. We find out from screenshots in review, " +
        "or later.",
      decision:
        "Still deciding between Chromatic and a self-hosted Playwright " +
        "snapshot job. Chromatic is less to run and more to pay for; " +
        "Playwright is the reverse.\n\n" +
        "- [ ] Cost at our story count\n" +
        "- [ ] How each handles OKLCH rendering differences across platforms\n" +
        "- [ ] Whether review comments belong in the tool or in the PR",
      consequences: "",
    },
    refs: [],
  });
  log("parked one draft, still being written");

  console.log("\nDone.");
  console.log(`  workspace : ${workspace.key}: ${workspace.name}`);
  console.log(`  sign in as: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  author    : ${AUTHOR_EMAIL} / ${AUTHOR_PASSWORD}`);
}

/**
 * Postgres errors arrive wrapped in the failing query, which is the least
 * useful part of them. The three ways this actually goes wrong all have a
 * specific fix, so say the fix.
 */
function explain(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
  const code = cause?.code;

  if (code === "42P01" || /relation .* does not exist/i.test(raw)) {
    return [
      "The tables do not exist in that database yet.",
      "",
      "Run the schema push against the same DATABASE_URL first:",
      "  DATABASE_URL='…' npx drizzle-kit push",
    ].join("\n");
  }

  if (code === "28P01" || /password authentication failed/i.test(raw)) {
    return [
      "Postgres rejected those credentials.",
      "",
      "Check the password in DATABASE_URL is the real one; a placeholder left",
      "in by mistake fails exactly like this.",
    ].join("\n");
  }

  if (code === "ENOTFOUND" || /getaddrinfo|ENOTFOUND|ECONNREFUSED/i.test(raw)) {
    return "Could not reach that host. Check the connection string is complete and quoted.";
  }

  if (/breach|compromised/i.test(raw)) {
    return [
      "The demo password was rejected as breached.",
      "",
      "Sign-up runs a HaveIBeenPwned check, so DEMO_USER_PASSWORD must be at",
      "least 10 characters and not appear in a known breach.",
    ].join("\n");
  }

  return raw;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed failed.\n");
    console.error(explain(error));
    process.exit(1);
  });
