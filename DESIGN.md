# core: design notes

## What core is

A decision log for a signed-in team. Each decision is an architecture decision record (ADR) with
a lifecycle, permission-gated transitions, a history of its text, a log of its status changes, and
references to code in GitHub that are checked for changes.

The lifecycle, its permissions and supersession between decisions are the centre of the design.
Real-time collaborative editing was considered and not built: an ADR is written by one person and
reviewed by others.

---

## Architecture

Next.js App Router pages and server actions over two engines in `lib/`, each written against a
storage interface with an in-memory and a Postgres implementation.

```
lib/versioning/        document history, independent of decisions
  diff.ts                structural JSON diff over RFC 6901 pointers
  engine.ts              snapshot, commit, restore and history over a VersionStore
  memory-store.ts        in-memory VersionStore
  drizzle-store.ts       Postgres VersionStore

lib/decisions/         the decision domain
  types.ts, store.ts     records and the DecisionStore port (32 methods)
  lifecycle.ts           transitions as a data table, gated by capability
  service.ts             DecisionService: lifecycle, versioning and the store together
  lineage.ts             the supersession chain in both directions
  snippet.ts             comparing a cited line range, and finding it if it moved
  citation.ts            the {{owner/repo:path#lines}} token
  drift.ts               a reference's status relative to its baseline
  key.ts                 workspace keys and ADR labels (HAU-001)
  retry.ts               retrying the ADR-number insert after a unique violation
  form.ts, draft-label.ts  reading form data; naming an untitled draft
  seeded-draft.ts        the demo's seeded draft and its nightly restore
  memory-store.ts        in-memory DecisionStore
  drizzle-store.ts       Postgres DecisionStore

lib/markdown/editing.ts  textarea editing: lists, indentation, wrapping
lib/db/                  Drizzle schema and client
lib/github.ts            repository trees, file contents, blob SHAs, token selection
app/app/actions.ts       server actions: authentication, demo refusals, GitHub calls
```

### Storage is a port

`DecisionService` and `Versioning` depend on store interfaces. The memory and Drizzle stores
implement the same interface, so domain tests run real service code against the memory store.

Two writes must succeed or fail together, and each is one store method, so the Drizzle store wraps
each in a transaction: creating a decision with its opening transition, and changing a status with
its transition row.

### What the tests prove about the Postgres store

Every domain test uses the memory store. Two suites check the Postgres store against it.

`store-parity.test.ts` checks that both stores implement the port's 32 methods, listed in the test
rather than read from either store. TypeScript checks each class against the interface, but a
method removed from the interface and both classes still typechecks while the service calls it.
The suite checks no behaviour: a different order, a null handled differently or a transaction in
the wrong place all pass.

`store-contract.test.ts` runs 43 cases against both stores with the same assertions. The Postgres
store runs on PGlite, Postgres compiled to WebAssembly and run in the test process, so constraints,
types and transactions behave as in Postgres, with no Docker, service container or `DATABASE_URL`.
`test/pg.ts` generates the DDL from the Drizzle schema on each run, so the tests use the current
schema.

The e2e suite runs against a real Postgres server instead. PGlite behind a socket was tried and
failed there: it accepts one connection at a time, and Next.js with better-auth opens several.

---

## Data model

| Table | Holds |
|---|---|
| `workspaces` | Name and key (`HAU`) |
| `memberships` | User, workspace, role (`author` or `maintainer`) |
| `decisions` | Workspace, number, title, status, author, `supersededById`, the versioned document's id. Unique on workspace and number |
| `decision_transitions` | From, to, actor, time, reason. Append-only |
| `decision_references` | File or link references: label, URL, repository, path, line range, cited text, baseline and current blob SHA, when last checked |
| `decision_drafts` | Author, workspace, title, body, cited references. No number |
| `workspace_repos` | Connected repositories. Unique on workspace, owner and name |
| `documents`, `document_versions` | The versioning engine's documents and commits |
| `user`, `session`, `account`, `verification` | better-auth. `account` holds linked GitHub tokens |

---

## Decisions

### Build on haus

core did not use haus at first, because a library still changing its interface would have moved
core's with it. After haus 1.0.0 published a token contract, core took `haus-tokens` (primitives,
its own brand in `brands/core.css`, and the semantic roles) and `haus-components`. What core took
and kept is listed under [What core takes from haus](#what-core-takes-from-haus-and-what-it-keeps).

### Restore is a forward commit

Restoring a version writes a new commit whose content equals it, as `git revert` does. Moving the
head back was rejected: it removes commits, so a restore would erase work committed after the
restored version, and the restore itself would leave no record.

### Two audit trails

Text revisions are commits in the versioning engine. Status changes are rows in the append-only
`decision_transitions` table. One asks how the text changed, the other when and by whom the decision
moved, and a single timeline would mix edits with approvals.

### Accepted decisions are immutable

`canEditContent` refuses any decision not in `proposed`. To change an accepted decision, a new one
is accepted and supersedes it, so the accepted text stays as it was agreed.

### Guards return a reason

Every lifecycle check returns `{ ok: true }` or `{ ok: false, reason }`, for example "requires the
accept capability" or "a decision is immutable once it leaves 'proposed'". The interface can then
tell a missing permission from a decision that has already moved on.

---

## Drafts

A draft is not a lifecycle status, and is stored in `decision_drafts`, not `decisions`.

- **No ADR number.** A number reserved for a draft that is then abandoned leaves a gap in the
  sequence, and people cite decisions by number.
- **Private to its author**, maintainers included. Every decision is visible to the workspace.
- **No transitions.**
- **No title required.** A missing title is derived from the first line written, preferring the
  Decision section (`draft-label.ts`).
- **Not versioned.** The versioning engine records how a decision's text changed for the team. A
  draft has no readers yet.
- **Bounded.** `saveDraft` is available to any member, so a draft is capped at 128KB and an author
  at 20 drafts per workspace.

### Local autosave and server drafts

`localStorage` holds a compose session that has not reached the server, for a crashed browser or a
closed tab. A server draft is saved on purpose and appears in the decisions list. Once a server
draft exists, local autosave stops, because the list is where it will be found.

A local copy found on return is offered, not applied, because replacing what is on screen with
older text would lose the newer text.

---

## Code references and drift

### A citation names a range

A whole-file reference is marked changed by any commit to the file, including one to an unrelated
function, and the larger the file the more often that happens. A line range is marked changed only
when those lines change.

### A moved block is not a change

The cited text is stored with the range. When the text is no longer at those lines, the file is
searched for it before the reference is marked drifted. Twenty lines inserted above a block move it
to new lines without changing it. Trailing whitespace is removed before comparing, so reformatting
does not count. Leading indentation is kept, because a block that changed indentation changed
scope.

### The baseline moves on acceptance

A citation made while drafting records the code the author saw. On acceptance, each reference's
baseline moves to the code at that moment, so a proposal that sat in review while its code changed
is not drifted the moment it is accepted. A block that moved during review is followed to its new
lines, not pinned to the old line numbers. Re-baselining is best-effort: the acceptance is already
recorded, and a GitHub failure does not undo it.

### Drift is checked when reading

Drift is not checked while composing or editing. A file cited seconds ago can only be in sync. The
status is shown on the decision page, where someone decides whether the decision needs revisiting.
A re-check records each reference's current SHA.

### Citations are plain text

`{{owner/repo:path#L47-L120}}` can be typed, pasted and copied into a commit message or chat. An
editor node would not survive the copy. Tokens become ordinary markdown links before parsing, so
react-markdown renders them with no plugin and its escaping applies. A token that does not resolve
renders as inline code.

---

## Interface

### Write and Preview use the same type

The compose editor has no field backgrounds or borders, and its type metrics match the rendered
markdown, so text does not reflow between Write and Preview. Each ADR section is marked by a left
gutter rule that takes the accent colour on focus.

The editor is a `<textarea>`. A rich editor (CodeMirror, contenteditable) was rejected: it would be a
second rendering of the document to keep in step with the markdown renderer. List continuation, Tab
indentation and wrapping shortcuts are functions from text and selection to text and selection, in
`lib/markdown/editing.ts`, tested without a DOM.

### Editing is its own page

Inline editing left the properties, notices and tabs above the editor, with two Edit buttons
visible at once. Editing an existing decision now uses the same page as composing a new one.

### One sheet on the decision page

The decision page had five cards at three widths, on two backgrounds and two elevations. Now the
document is the one white sheet; properties, notices and tabs sit on the page background, and every
region shares the sheet's width.

The dossier card is the exception. It holds status, owner and dates, and the activity history opens
inside it, since those dates summarise that history.

### One notice

Notices are tinted, not raised. The only notice left is the drift warning. Status and authorship,
which used to be banners, are properties.

### Buttons

A labelled action is haus `Button`, and every one has a background, because a transparent button
with a word in it reads as a link. There is no ghost variant; the default is the lightest fill.
There is one filled accent per view. Approve is green instead of the accent, because the accent also
marks primary actions and links.

An icon-only control inside a container is haus `IconButton`: the × on a row, a toolbar button, a
refresh beside a timestamp. These fill on hover only, because a toolbar of eight filled squares is
harder to scan.

### Irreversible transitions ask first

Approve, Reject and Deprecate each open a confirmation (`ConfirmAction`, over haus `Modal`) whose
primary button has the tone of the button that opened it. Approve also makes the decision immutable.
Supersede has its own modal, to choose the replacement. The drift re-check has no confirmation.

### File tokens

A file path is shown two ways. A **chip** sits in a line of text and shows the filename. A **row**
sits in a list, shows the full path, and has a slot on the right for a drift badge, a remove button
or a range picker.

### Visual language

An off-white page, white cards separated by fill instead of borders, Gabarito for text and Geist
Mono for code, paths and diffs. Accent colours come from a print-like palette of vermilion, mustard,
teal and cobalt, at the saturation and lightness of printed ink.

---

## What core takes from haus, and what it keeps

**C4** in the haus adoption. Written as the migration landed.

### Taken

Thirteen components: `Button`, `IconButton`, `Modal`, `Input`, `Select`, `Badge`, `Card`, `Callout`,
`EmptyState`, `Tabs`, `Popover`, `Avatar`, and `Toast`'s surface, over the token layer from
`brands/core.css`. `Select` is the themed picker haus used to call `Listbox`.

The account menu is `Avatar` inside `Popover` with `role="menu"`, replacing core's own open, close,
outside-click and placement code. The avatar's fill changed: haus derives it from the name, where
core used its accent tint.

The Write and Preview switch is `Tabs` with `appearance="segmented"`. It stayed core's own until
`haus#67` gave `Tabs` a `panelId`, because haus rendered the tablist and panel as adjacent siblings,
and core's tablist is a sticky toolbar with the form between it and the document sheet.

The status colours moved too. The six `--st-*` tokens were used by the password strength meter,
timeline banners and diff colours as well as status. Those read haus's feedback roles now, status
badges use haus `Badge` tones (haus decision 0021), and the six tokens are deleted.

Four adapters remain, each adding one thing haus does not know about: `SubmitButton` and
`SubmitIconButton` read `useFormStatus`, which only works inside the form; `ModalShell` sets
`dismissOnBackdrop={false}` and focuses the first field; `ConnectGithubButton` starts the OAuth
flow.

### Kept

**Domain components**: `DecisionEditor`, `DecisionMeta`, `DecisionReferences`, `Lineage`,
`DraftList`. A design system has no model of a decision record.

**Citation components**: `FileBrowser`, `FileToken`, `ReferenceField`, `LiveReferenceField`,
`CitationInsert`.

**Content rendering**: `Markdown` and `Mermaid`, which wrap libraries.

**The shell**: `AuthShell`, `TopBar`, `AuthForm`, `DemoCredentials`.

**`PasswordField`.** It uses haus `Input`, with the reveal toggle in the `suffix` slot. The strength
meter stays core's. The label sits beside the input instead of wrapping it: wrapping made the
accessible name "Password Show, edit text" and moved focus into the field on every reveal, which an
end-to-end test found. haus `Input` places its label the same way.

**The editor's `<textarea>`.** It is the writing surface, with a ref, keyboard handling and its own
sizing. haus `Textarea` adds label and hint markup it does not need.

**sonner.** haus `Toast` is a surface with no provider, queue, positioning or dismissal (haus
decision 0008). core renders that surface inside sonner's queue with `toast.custom`, in
`lib/toast.tsx`: sonner queues and dismisses, haus draws.

---

## Deployment

[core.hipuku.dev](https://core.hipuku.dev) runs on Vercel with functions in `syd1`, against a Neon
database in Sydney. A signed-in page load makes several queries in sequence (session, membership,
data). With the functions in Vercel's default US region, each query crossed the Pacific.

### What the demo switches off

**Sign-up** (`DISABLE_SIGNUP=1`). `/sign-up` is a 404. An invite code was rejected: whoever holds one
can pass it on. There is one seeded account.

**Writing to the decision log.** The demo account (`DEMO_USER_EMAIL`) may save and discard drafts.
Fifteen actions refuse it: creating, editing and deleting workspaces, inviting and removing members,
connecting and disconnecting repositories, adding and removing references, proposing, revising,
changing status, superseding, and re-checking drift. The refusal is in the action layer, because it
belongs to this deployment, not to what a decision log allows. Three actions that only read from
GitHub need no refusal.

Every visitor signs in as that account, so its drafts are shared between visitors, not private.
`/api/cron/prune-drafts` runs nightly (`vercel.json`), deletes its drafts not updated in 24 hours, and
then restores the seeded draft if no draft with its title remains. The route requires `CRON_SECRET`
as a bearer token and refuses to run when the secret is unset where a demo account is configured.

**GitHub linking** (`DISABLE_GITHUB=1`). The OAuth flow requests the `repo` scope, which can write
to private repositories, and better-auth stores the token in `account`. On a public deployment that
means holding strangers' write tokens.

### Browsing without users' tokens

`GITHUB_PUBLIC_TOKEN` is a token of the deployment owner's, read-only and limited to public
repositories. `getReadToken` uses a linked account when there is one, since it can reach private
repositories, and the public token otherwise. On the demo nobody has a linked account.

Connecting a repository still needs the person's own account: listing repositories with the
deployment's token would show the owner's repositories to whoever is signed in.

Repository trees are cached per server instance for five minutes. The file picker requests every
connected repository's tree on each mount, and without the cache a few visitors would use up the
hourly GitHub API allowance.

### Server actions return errors

React reports a server action that throws as error #441, with the message removed in production
builds. Every failure the file picker can meet (not a member, GitHub off, no linked account, no
connected repositories, GitHub unreachable) is returned as a message. Two earlier fixes changed the
wrong throw before this was found.

---

# Known trade-offs / next

- **`app/app/actions.ts` (751 lines) has no tests of its own.** It holds `requireUser` and the demo
  refusals. Its pure helpers are tested where they moved: `lib/attempt.ts` and
  `lib/decisions/form.ts`. `snapshotFile`, `attachCitedFiles` and `rebaselineOnAccept` need GitHub
  and a store, and need fakes to test.
- **Token debt: 11** declarations with no haus token, held by `scripts/check-token-debt.mjs`, which
  fails when the count moves either way. It started at 355. The eleven: two `em` paddings, two
  `min-height`, two `z-index`, the app shell's padding, the password field's right padding for its
  reveal button, a negative margin, a `box-shadow` and a `4px` radius. Zero is not the target.
- **The seed's workspace is found by name.** Re-seeding deletes any workspace named `haus`, and the
  draft restore looks for one. A real workspace with that name on the same database would be
  replaced.
- **Email verification is off, and there is no rate limiting** beyond the draft limits. Neither
  matters while sign-up is closed. Both are needed before it opens.
- **Tracking files cited in the text.** A citation in the body is not added to the references
  checked for drift, because a file cited as a counter-example is not governed by the decision. A
  citation with no matching reference looks inconsistent; a "track this file" control on it is the
  likely next step.
- **Adding link references from the interface.** Removed when the reference field was unified on
  files. A markdown link in the body does the same job.
- **`drizzle-kit` npm audit warnings** are in development dependencies. `npm audit fix --force`
  downgrades `drizzle-kit`; they are left.
