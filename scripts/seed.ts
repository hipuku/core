/**
 * Seed a workspace with a decision log that has actually been used.
 *
 * The decisions here are **real**: they are haus's own rulings, the same ones
 * recorded in that repository's `docs/decisions/`, with their genuine statuses.
 * HAU-001 really was superseded, HAU-003 really did propose the cheap option
 * and argue itself out of it, HAU-004 really was rejected, and the draft is
 * genuinely undecided. It used to be a plausible invention about a product
 * called Vault, and two of those invented records had quietly drifted into
 * being false — one asserted a rule this codebase breaks, another described a
 * dependency the repository has since taken.
 *
 * A decision log demoing itself with fiction is the wrong advertisement for a
 * decision log.
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
const WORKSPACE_NAME = "haus";
/** The workspace this seed used to build, cleared on the way past. */
const RETIRED_NAME = "Vault";

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
  //
  // RETIRED_NAME is here because this seed used to build a workspace called
  // "Vault" holding invented decisions. Idempotency is keyed on the name, so
  // renaming the workspace would otherwise leave that one standing beside the
  // new one and the demo would show both. It can be deleted once every
  // environment has been re-seeded at least once.
  for (const name of [WORKSPACE_NAME, RETIRED_NAME]) {
    const [stale] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.name, name))
      .limit(1);
    if (stale) {
      await db.delete(workspaces).where(eq(workspaces.id, stale.id));
      log(`removed the previous "${name}" workspace`);
    }
  }

  const workspace = await decisionService.createWorkspace(demoId, WORKSPACE_NAME);
  await decisionService.addMember(workspace.id, authorId, "author");
  log(`workspace ${workspace.key}: ${workspace.name}`);

  // Connected first, and this matters: an inline `{{owner/repo:path}}` citation
  // only renders as a file chip when its repo is connected to the workspace.
  // Without these the tokens below fall back to plain code, which is the
  // graceful degradation working correctly and looking like a bug.
  for (const repo of [
    { owner: "hipuku", name: "haus", defaultBranch: "main" },
    { owner: "hipuku", name: "drift", defaultBranch: "main" },
  ]) {
    await decisionService.connectRepo(workspace.id, demoId, repo);
  }
  log("connected hipuku/haus and hipuku/drift");

  /* ---- HAU-001: accepted, then superseded -------------------------------
     The claim the README carried for months. It was true of the intent and not
     of the file, which is the whole reason 002 exists. */
  const oneLayer = await decisionService.propose(workspace.id, demoId, {
    title: "Theming lives entirely in the semantics layer",
    body: {
      context:
        "The token layers are primitives, semantics and motion. A consumer who " +
        "wants haus's structure under their own brand needs somewhere to put " +
        "that brand, and the semantics layer is where every role is already " +
        "named.",
      decision:
        "Brand and role swaps live in {{hipuku/haus:packages/tokens/src/semantics.css}}. " +
        "A theme swap is a single-file change with **zero component edits**.\n\n" +
        "1. Primitives hold raw values and no component reads one directly.\n" +
        "2. Semantics hold intent: `--color-surface-default`, `--color-ink-primary`.\n" +
        "3. A consumer overrides the semantics layer and changes nothing else.",
      consequences:
        "Easier: one file to look at, and one sentence to put in the README.\n\n" +
        "Harder: nothing yet, which should have been the warning. No consumer " +
        "had tried it at the time this was written.",
    },
  });
  await decisionService.changeStatus(oneLayer.id, demoId, "accepted");

  /* ---- HAU-002: accepted, supersedes 001 --------------------------------
     The showcase record: headings, a table, a task list, a blockquote, a
     mermaid diagram and inline file citations that resolve to the repos
     connected above. */
  const split = await decisionService.propose(workspace.id, demoId, {
    title: "Split the brand out of the role layer",
    body: {
      context:
        "HAU-001 was checked against the code and did not survive it.\n\n" +
        "{{hipuku/haus:packages/tokens/src/semantics.css}} is 242 lines. Lines " +
        "37 to 121 are colour roles that alias palette ramps directly: " +
        "`--color-surface-default` is `var(--damson-0)`, and the four feedback " +
        "families are named after fruit. Lines 122 to 242 are type, spacing, " +
        "radius, elevation and motion. **The brand and the role system are the " +
        "same file**, so taking the roles means taking the brand.\n\n" +
        "There is no scoping selector anywhere: a search for `data-theme` or " +
        "`:root[` returns nothing, so every token sits on a bare `:root` and " +
        "`--space-4` is in the global namespace where a consumer running " +
        "Tailwind collides with it.\n\n" +
        "> Two products had already answered this. One declared 159 custom " +
        "> properties of its own. The other declared 348 lines and took no " +
        "> dependency on the token tier at all, with all five packages already " +
        "> published.\n\n" +
        "The role layer is not what they rejected. Of the 40 differing values, " +
        "six differ only by decimal padding and about thirty are palette-name " +
        "swaps. **The roles work. The brand is the part that cannot move.**",
      decision:
        "Split them, and give the brand a layer of its own.\n\n" +
        "```mermaid\n" +
        "graph TD\n" +
        "  P[haus.primitives<br/>raw values] --> S[haus.semantics<br/>roles]\n" +
        "  B[haus.brand<br/>the one file a consumer owns] --> S\n" +
        "  S --> M[haus.motion]\n" +
        "  S --> C[haus.components]\n" +
        "  linkStyle 1 stroke:#7c5cbf,stroke-width:2\n" +
        "```\n\n" +
        "- [x] Agree the contract before writing it — " +
        "{{hipuku/haus:docs/decisions/0003-brand-and-roles-are-separate-layers.md}}\n" +
        "- [ ] A fourth cascade layer for the brand map\n" +
        "- [ ] `--haus-` on every property at every layer\n" +
        "- [ ] A `data-haus-theme` scoping selector\n" +
        "- [ ] A generated TypeScript map type, so a consumer knows what they owe\n" +
        "- [ ] One complete worked example brand beside the default\n\n" +
        "This **supersedes HAU-001** rather than revising it. The intent was " +
        "right and the file was wrong.",
      consequences:
        "| | One layer | Brand split out |\n" +
        "|---|---|---|\n" +
        "| Files a consumer owns | none that work | one |\n" +
        "| Global namespace collisions | yes | prefixed |\n" +
        "| Breaking for token readers | — | **yes** |\n" +
        "| Consumers today | 1 | 1 |\n\n" +
        "Breaking, so it lands with the 1.x cut and a migration guide rather " +
        "than on its own. It is cheapest now: one consumer reads the token " +
        "tier today and three are planned.\n\n" +
        "**One worked example does not prove a contract.** This is not " +
        "demonstrated until a second brand map exists on a codebase that was " +
        "not written to flatter it.",
    },
  });
  await decisionService.changeStatus(split.id, demoId, "accepted");
  await decisionService.supersede(split.id, oneLayer.id, demoId);
  log("HAU-002 accepted, superseding HAU-001");

  /* ---- HAU-003: proposed, revised, awaiting review ----------------------
     A real reversal: the cheap option was written down first and argued out
     of. The revision is the argument. */
  const guard = await decisionService.propose(workspace.id, authorId, {
    title: "Guard the token contract at the package boundary",
    body: {
      context:
        "`var(--x)` for an undefined `--x` drops the declaration silently: no " +
        "console warning, no build error, and a focus ring that is simply absent.",
      decision:
        "Export a function consumers call from their own suite, given the CSS " +
        "they load. The cheapest of the three shapes on the table.",
      consequences:
        "The contract becomes testable rather than enforced. Each consumer has " +
        "to remember to call it.",
    },
  });
  await decisionService.revise(guard.id, authorId, {
    context:
      "`var(--x)` for an undefined `--x` drops the declaration silently: no " +
      "console warning, no build error, and a focus ring that is simply absent.\n\n" +
      "This is not hypothetical. The one consumer that wrote the check found " +
      "five undefined roles before they reached a screen — " +
      "{{hipuku/drift:client/src/tokens/tokens.test.ts}} — and then caught a " +
      "sixth defect in a *published* package within an hour of upgrading: " +
      "three control-height roles read by `haus-components` and not declared " +
      "by the `haus-tokens` version it depends on. Button, Input and Select " +
      "had shipped with no `min-height` for two minor versions and nothing " +
      "said so.\n\n" +
      "> That test lives in the consumer. Every future consumer either writes " +
      "> it again or ships a dropped declaration.\n\n" +
      "There is a second problem underneath, and only one of the three options " +
      "touches it: `styles.css` is unlayered while the tokens are layered, so " +
      "it competes with a consumer's own module CSS by **source order**.",
    decision:
      "**Wrap the component stylesheet in its own cascade layer.** Not the " +
      "exported function this record originally proposed.\n\n" +
      "Three shapes were on the table:\n\n" +
      "| | Exported function | stylelint config | Cascade layer |\n" +
      "|---|---|---|---|\n" +
      "| Cost | half a day | a day | a day |\n" +
      "| Enforced | no | at lint time | by the cascade |\n" +
      "| Constrains consumer CSS | no | **yes** | no |\n" +
      "| Fixes the unlayered stylesheet | no | no | **yes** |\n" +
      "| Breaking | no | no | yes |\n\n" +
      "The layer is the only one that makes the package declare its own " +
      "precedence instead of relying on how a consumer arranges their CSS, " +
      "and the only one that also fixes the second problem.\n\n" +
      "```css\n" +
      "@layer haus.components {\n" +
      "  .button { /* a consumer's own CSS now wins without a specificity fight */ }\n" +
      "}\n" +
      "```",
    consequences:
      "Breaking for anyone relying on current source order.\n\n" +
      "**The timing is the whole argument.** It costs nothing while one " +
      "consumer reads the component tier. Two more are planned, and each one " +
      "added before this lands makes it more expensive.\n\n" +
      "- [x] Establish that the cheap option leaves the layering bug\n" +
      "- [x] Confirm only one consumer reads the component tier today\n" +
      "- [ ] Land it with the 1.x cut, not before\n\n" +
      "**Open for review:** the reversal is the part to push back on. This " +
      "record proposed the cheap option and argued itself out of it.",
  });
  log("HAU-003 proposed by an author, then revised, awaiting review");

  /* ---- HAU-004: rejected ------------------------------------------------ */
  const meta = await decisionService.propose(workspace.id, authorId, {
    title: "Ship a haus meta-package",
    body: {
      context:
        "A consumer wanting the token layer, the components and the colour " +
        "maths tracks four version lines that are only ever released together " +
        "in practice. A `haus` meta-package depending on a compatible set at " +
        "exact versions would let them take one.",
      decision:
        "Publish `haus`, a sixth package, pinning the other five at exact " +
        "versions and re-exporting nothing.",
      consequences:
        "One version line for consumers. A sixth package on the release path.",
    },
  });
  // Proposed by the author, rejected by the owner: the author role has no reject
  // capability, which is the permission model showing rather than describing
  // itself. Seeding this the other way round is how that was found.
  await decisionService.changeStatus(
    meta.id,
    demoId,
    "rejected",
    "The convenience was worth less than it looked. Going to 1.x already " +
      "fixed what motivated it — under a caret a minor now reaches a consumer " +
      "on their next install — so the pain was the 0.x caret rule rather than " +
      "the package count. What is left is a second place a version is stated, " +
      "and two sources of truth for one fact is the failure mode this project " +
      "keeps paying for. Tier-per-package is also what a tiered system should " +
      "look like from outside: one bundled version line claims the tiers " +
      "cannot be released independently, which is not true.",
  );
  log("HAU-004 rejected");

  /* ---- HAU-005: accepted, then deprecated ------------------------------- */
  const zeroX = await decisionService.propose(workspace.id, demoId, {
    title: "Stay on 0.x until the API settles",
    body: {
      context:
        "Five packages, an API still moving, and no consumer outside this " +
        "repository yet. Committing to a stable major before the component " +
        "props have settled would mean majors for changes nobody has to " +
        "migrate through.",
      decision:
        "Keep every package on `0.x`. Breaking changes go out as minors, which " +
        "is what `0.x` means.",
      consequences:
        "Freedom to move, at the cost of the caret rule: under `^0.2.1` a " +
        "minor cannot reach a consumer while a patch can.",
    },
  });
  await decisionService.changeStatus(zeroX.id, demoId, "accepted");
  await decisionService.changeStatus(
    zeroX.id,
    demoId,
    "deprecated",
    "The cost stopped being theoretical. `haus-colour-utils` 0.3.0 refitted " +
      "the hue bins; both consumers were pinned to `^0.2.1`, neither picked it " +
      "up, and the refit sat unshipped until someone went looking. Replaced by " +
      "the 1.x ruling and the bump table in " +
      "{{hipuku/haus:RELEASING.md}} — where a token rename is a major at an " +
      "identical value, and a contrast change is a major even when the hex " +
      "barely moves.",
  );
  log("HAU-005 accepted, then deprecated");

  /* ---- references -------------------------------------------------------
     Every file cited inline is also attached as a reference, so the chips in
     the sidebar and the inline citations show the same set. */
  const drifted = await decisionService.addReference(split.id, demoId, {
    kind: "file",
    label: "hipuku/haus · packages/tokens/src/semantics.css",
    url: "https://github.com/hipuku/haus/blob/main/packages/tokens/src/semantics.css",
    repo: "hipuku/haus",
    path: "packages/tokens/src/semantics.css",
    baselineSnippet:
      "@layer haus.semantics {\n  :root {\n    --color-surface-default: var(--damson-0);\n  }\n}",
    baselineSha: "8f2c1a4e9d3b7f6a5c8e2d1b4a7f9c3e6d8b2a5f",
  });
  await decisionService.recordReferenceState(
    drifted.id,
    demoId,
    "3c9e7b1d5a8f2e6c4b0d9a7f3e1c8b5d2a6f4e9c",
  );
  await decisionService.addReference(split.id, demoId, {
    kind: "file",
    label: "hipuku/haus · docs/decisions/0003-brand-and-roles-are-separate-layers.md",
    url: "https://github.com/hipuku/haus/blob/main/docs/decisions/0003-brand-and-roles-are-separate-layers.md",
    repo: "hipuku/haus",
    path: "docs/decisions/0003-brand-and-roles-are-separate-layers.md",
  });
  await decisionService.addReference(oneLayer.id, demoId, {
    kind: "file",
    label: "hipuku/haus · packages/tokens/src/primitives.css",
    url: "https://github.com/hipuku/haus/blob/main/packages/tokens/src/primitives.css",
    repo: "hipuku/haus",
    path: "packages/tokens/src/primitives.css",
  });
  await decisionService.addReference(guard.id, authorId, {
    kind: "file",
    label: "hipuku/drift · client/src/tokens/tokens.test.ts",
    url: "https://github.com/hipuku/drift/blob/main/client/src/tokens/tokens.test.ts",
    repo: "hipuku/drift",
    path: "client/src/tokens/tokens.test.ts",
  });
  await decisionService.addReference(guard.id, authorId, {
    kind: "file",
    label: "hipuku/haus · packages/components/src/tokens.test.ts",
    url: "https://github.com/hipuku/haus/blob/main/packages/components/src/tokens.test.ts",
    repo: "hipuku/haus",
    path: "packages/components/src/tokens.test.ts",
  });
  await decisionService.addReference(zeroX.id, demoId, {
    kind: "file",
    label: "hipuku/haus · RELEASING.md",
    url: "https://github.com/hipuku/haus/blob/main/RELEASING.md",
    repo: "hipuku/haus",
    path: "RELEASING.md",
  });

  /* ---- a link reference, so both kinds are visible ---------------------- */
  await decisionService.addReference(guard.id, authorId, {
    kind: "link",
    label: "MDN · CSS cascade layers",
    url: "https://developer.mozilla.org/en-US/docs/Web/CSS/@layer",
  });

  /* ---- a parked draft ---------------------------------------------------
     So the drafts zone is not empty on arrival, and the difference between a
     draft and a decision (no number, a Draft tag, private to its author) is
     visible rather than described. This one is genuinely undecided. */
  await decisionService.saveDraft(workspace.id, demoId, {
    title: "Reopen polarity, so dark mode can exist",
    body: {
      context:
        "Surface polarity is fixed by the contract: white cards on a subtle " +
        "page, and not a brand-map axis. Every surface role is paired with the " +
        "ink that is safe on it, and that pairing is what makes contrast " +
        "decidable once at the token layer.\n\n" +
        "The consequence nobody wrote down until recently is that **a dark " +
        "theme cannot arrive as a brand map**, because it is a polarity " +
        "inversion. It is the first thing anyone asks a design system.",
      decision:
        "Still deciding. Three shapes, none costed:\n\n" +
        "- [ ] Leave it. Say plainly that dark mode is out of scope and why\n" +
        "- [ ] Make polarity an axis, and pair ink per polarity — doubles the " +
        "colour decision surface\n" +
        "- [ ] A second contract rather than a second brand, so the pairing " +
        "guarantee survives\n\n" +
        "The third is the only one that keeps the promise the roles make. It " +
        "is also the most work, and it is not obvious it should happen before " +
        "a consumer asks for it.",
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
