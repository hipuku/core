# DESIGN.md for core

## Context

core is a team decision log: architecture decision records with a lifecycle,
permissions and an audit trail, for a signed-in team.

The centrepiece is the lifecycle state machine, its permission-gated
transitions, and the supersession graph. Real-time collaborative editing was the
alternative and it answers a question this domain does not ask: ADRs are drafted
by one person and reviewed by others.

**North star:** governed design documents connected to the code they govern.
Notion holds the document but not the governance. Jira holds the workflow and is
not a document. The gap is a document that carries its own governance and knows
about the code it decided.

---

## Standing decisions

### core depends on no local package

It has its own CSS and its own visual language. Depending on a library under
active development would mean its interface moved whenever that library did.

### The module map

```
lib/versioning/     append-only document history: pure, tested, domain-agnostic
  diff.ts             structural JSON diff over RFC 6901 pointers
  engine.ts           snapshot / commit / restore / history over a storage port
  memory-store.ts     in-memory VersionStore
  drizzle-store.ts    Postgres-backed VersionStore, same interface

lib/decisions/      the domain
  lifecycle.ts        the state machine as a data table, capability-gated
  service.ts          orchestration over lifecycle + versioning + a store port
  snippet.ts          comparing a cited range of a file, and finding it if it moved
  citation.ts         the {{repo:path#lines}} token
  drift.ts            where a reference stands relative to the code it cited
  key.ts              per-workspace ADR keys (VAU-001)
  retry.ts            the one write that can lose a race, and what it does about it
  memory-store.ts     in-memory DecisionStore
  drizzle-store.ts    Postgres-backed DecisionStore, same interface

lib/markdown/       textarea editing behaviour: lists, indent, wrapping
lib/db/             Drizzle schema and client
lib/github.ts       repo trees, file contents, blob SHAs
```

### Storage is a port

Both engines depend on a store interface. `memory-store` and `drizzle-store`
implement the same contract, so the test suite exercises real domain behaviour
rather than mocks, and swapping storage changes where data lives and nothing
about how the domain behaves.

The two writes that must not tear are single methods on that interface, so the
Drizzle implementation can wrap each in one transaction: a decision and its
opening transition, and a status change and its audit row.

**What the suite proves, and what it does not.** Every domain test constructs
`memory-store`, so what it establishes about permissions and the lifecycle it
establishes about a double. Two suites close that, and they close different
halves.

`store-parity.test.ts` holds both stores to the port's 32 methods. It catches a
method added to one side and forgotten on the other, and catches nothing about
behaviour: an ordering difference, a null handled differently, a transaction
boundary in the wrong place would all pass. It is still worth having because
that failure is otherwise silent, since TypeScript checks each class against the
interface and a method dropped from the interface and both classes typechecks
cleanly while the service calls it.

`store-contract.test.ts` is the behavioural half and it is the one that matters:
**43 cases, each run twice against the same assertions, once per store.** A
difference between the double and the real thing is a failure rather than a
surprise in production.

It needs a Postgres and does not need one installed. PGlite is Postgres compiled
to WebAssembly and run in this process, so the planner, the types and the
constraint and transaction semantics are Postgres's rather than an emulator's.
No Docker, no service container, no `DATABASE_URL`. The DDL is generated from
the Drizzle schema rather than a checked-in dump, so a column added to
`lib/db/schema` is present on the next run and cannot drift out of step with the
tables the tests write to.

### Restore is a forward commit

Restoring an old version writes a new commit whose state equals the target,
rather than rewinding the head, the way `git revert` works. History stays
append-only and auditable, a restore is itself a versioned event, and multiple
people editing one document cannot silently erase each other's history.

### Two audit trails, deliberately separate

Content revisions live in the versioning engine; status transitions live in an
append-only `decision_transitions` log. "How did the text change" and "how did
the decision move" are different questions asked by different people at different
times, and collapsing them into one timeline would answer neither well.

### Accepted decisions are immutable

Past `proposed`, the body cannot be edited. You supersede a decision and link the
replacement, so what was decided and when cannot be quietly rewritten later.

### Guards return a reason rather than throwing

Every lifecycle check returns `{ ok: false, reason }`. The UI can then say *why*
an action is unavailable, so a person can tell a missing capability from a
decision that has already moved on.

---

## Drafts

A draft is **not a lifecycle status**, and lives in its own table.

- It holds **no ADR number**. Reserving one would leave permanent gaps in the
  sequence every time a draft is abandoned, and gaps in a numbered audit trail
  are exactly the wrong kind of mystery, with no way to repair them, because
  numbers are how people cite decisions.
- It is **private to its author**, including from maintainers, who have no
  business reading unfinished reasoning. Every real status is workspace-visible.
- It has **no transitions**, because nothing has happened to it yet.

Keeping drafts out of `decisions` is what lets the status enum stay an honest
description of a decision's life.

**Titles are not required.** A draft exists so half-formed work can be parked;
demanding a name before you may park it puts a form field in front of the escape
hatch. A missing title is derived from the first thing actually written,
preferring the Decision block.

**Draft edits are not versioned.** The versioning engine exists so a *team* can
see how a decision's text evolved. A draft has no audience yet.

### Two layers of draft safety, doing different jobs

`localStorage` is the crash net for a compose session that has never reached the
server. The browser dies twenty minutes in and there is nothing in any list to
recover from. A **server draft** is the deliberate act of parking something, and
appears in the decisions list. Once a server draft exists the local copy is
disabled, because the list is the better recovery route.

A found local draft is **offered**, and applied only when someone accepts it.
Replacing what they see on screen with older text is its own kind of data loss.

---

## Code references and drift

### A citation names a range

A whole-file reference drifts on any commit touching the file, so a typo in an
unrelated function marks the decision stale. False positives scale with file
size, and a staleness signal that cries wolf gets ignored, which defeats the
entire feature. Citing lines 47–120 changes the claim from "this file changed"
to "the code this decision governs changed".

### Movement is not change

The cited text is stored alongside the range. When a range no longer matches, the
text is searched for elsewhere in the file before anything is called drift:
insert twenty lines above a block and it is untouched but now lives at 67–140.
Trailing whitespace is normalised away, so a formatter run is not drift; changed
indentation *is* drift, because it means the block changed scope.

### The baseline moves when the decision is accepted

A citation made while drafting records the code the *author* was looking at. The
decision does not exist until the team accepts it, so that is when its reference
point should be fixed. Without this, a proposal that sat in review for a
fortnight is flagged as drifted the instant it is agreed.

A block that moved during review is *followed* rather than re-pinned. Pinning
the old line numbers blind would silently re-point the citation at whatever now
occupies them. Re-baselining is best-effort: the acceptance is an audited
transition that has already happened, and a GitHub outage must not undo it.

### Drift is a reading concern

No drift status and no drift check while writing or editing. A file cited moments
ago is in sync by construction, and a badge that can only ever say one thing is
not a status. Checking whether the world moved underneath a decision is the
question you ask *before* deciding to edit it, so it belongs on the document.

### Citations are plain text

`{{owner/repo:path#L47-L120}}` is a form the author can type, paste and edit, and
it survives being copied into a commit message or a chat thread, which a rich
editor node would not. Tokens are rewritten into ordinary markdown links before
parsing, so the renderer needs no plugin and inherits the escaping that
react-markdown has already hardened. An unresolvable token renders as inline code
rather than vanishing, so a typo stays visible.

---

## Interface

### Writing and reading are the same surface

The compose editor carries no field fills, no borders, and type metrics matching
the rendered prose exactly, so a paragraph does not reflow between Write and
Preview. The ADR's structure survives as a left gutter rule that takes the accent
on focus, the editor's only chrome. Preview is then a check on rendering rather
than a mode you have to live in.

The editor is a plain `<textarea>` by choice: no CodeMirror, no contenteditable,
no third-party editor to keep in sync with how the document later renders. What
makes it *feel* like markdown is behaviour while typing: lists that continue
themselves, Tab that indents, wrapping shortcuts. All of that is pure
text-in / text-out, tested directly.

### Editing is a page

Inline editing left the properties, the notices and the tabs stacked above the
editor, with two Edit affordances visible at once. Writing deserves the same
undistracted page whether the document is new or already numbered.

### Only the document is paper

The decision page had grown five cards across three widths, two grounds and two
elevations, and nothing said which surface mattered. One white sheet holds the
document; everything else (properties, notices, tabs) is annotation about it
and sits on the desk. Every region shares the sheet's measure, so the page has
two vertical edges rather than six.

The **dossier** card is the one exception. Status, owner and dates *are* the
current state of a decision's history, so the audit trail expands inside the card
that summarises it.

### Notices are tinted

Raising a notice puts it in competition with the sheet. What makes one urgent is
what it says. Only one notice survives, the drift warning; everything else that
used to be a banner is a property, because state and authorship are facts about
the record.

### Two button families

`.btn` is a labelled action on the page, and every one carries a background: a
transparent button with a word in it reads as a link, and a row mixing filled and
unfilled controls has no rhythm. There is no ghost variant. The default *is* the
quiet one, and it is quiet by carrying the lightest fill. One filled accent per
view; Approve keeps its own green, because it says "yes, and permanently" in a
way an accent that also means "primary" and "link" cannot.

`.iconbtn` is an icon-only affordance inside a container: the × on a row, a
formatting tool, a refresh beside a timestamp. Those fill on hover only, because
eight filled squares in a toolbar is noise, and because they belong to the thing
they sit in rather than to the page.

### One file token, two arrangements

A path rendered four different ways looked like a different kind of object
depending on the screen. A **chip** sits inside a line of text and carries the
filename only, because a full path cannot sit mid-sentence. A **row** sits in a
list, carries the whole path, and offers a slot on the right for what that list
needs: a drift badge, a remove control, a range picker.

### Visual language

Notion-inspired warm paper: an off-white desk, white cards separated by fill
rather than borders, Gabarito for type. Colour is drawn from a retro-print
palette of vermilion, mustard, teal and cobalt, at the saturation and lightness
of printed ink, and used only where it earns its place. Monospace is for code,
paths and diffs.

---

## What core takes from haus, and what it keeps

**C4**, the register the adoption owes. Written as the migration landed rather
than reconstructed after it, because the reasons are the point and they go stale
fastest.

### Taken

`Button`, `Modal`, `Input`, `Badge`, `IconButton`, `Listbox`, `Spinner`, and the
token layer under all of them via `brands/core.css`. Four thin adapters remain
and each adds exactly one thing haus cannot know about: `SubmitButton` and
`SubmitIconButton` read `useFormStatus`, which has to be read by a child of the
form; `ModalShell` sets `dismissOnBackdrop={false}` and focuses the first field;
`ConnectGithubButton` carries an OAuth call.

### Kept, and why

**The domain.** `DecisionEditor`, `DecisionMeta`, `DecisionReferences`,
`Lineage`, `DraftList`. These are the product. A design system has no opinion on
what an architecture decision record looks like.

**The citation model.** `FileBrowser`, `FileToken`, `ReferenceField`,
`LiveReferenceField`, `CitationInsert`. Same reason.

**Content rendering.** `Markdown`, `Mermaid`. Both wrap libraries and neither is
a control.

**The shell.** `AuthShell`, `TopBar`, `AuthForm`, `DemoCredentials`. Layout, and
layout is the one thing every product does differently.

**`PasswordField`.** Its label deliberately does not wrap its input: wrapping
made the accessible name *"Password Show, edit text"* and moved focus into the
field on every reveal, found by an end-to-end test. It also carries a reveal
toggle and a strength meter. haus `Input` has a `suffix` that could hold the
toggle, so this is deferrable rather than impossible, and it is the sole
remaining consumer of `.field` and `.input`. Those two rules go when it does.

**The editor's `<textarea>`.** Not a labelled field: it is the writing surface,
with a ref, keyboard handling and its own sizing, and haus `Textarea` would wrap
it in label and hint scaffolding it has no use for.

**The Write / Preview switch.** haus `Tabs` renders its tablist and panel as
adjacent siblings in one wrapper, and core's are a sticky toolbar and a document
sheet with the whole form between them. `haus#67`.

**sonner.** haus `Toast` ships a surface and deliberately no provider, queue,
positioning or dismissal, which decision 0008 records as a boundary rather than
a gap. Measured across the portfolio, core is the only product with toasts at
all, so a haus provider would have exactly one consumer. The open move is to
render haus's `Toast` surface inside sonner's queue via `toast.custom`.

**Five Next `<Link>` buttons.** `Button asChild` exists now (`haus#57`) and these
can move; they are the last consumer of `.btn`.

**The six `--st-*` tokens.** Not decision-state colours any more. Migrating the
badges retired `.pill` and left 21 uses in a password strength meter, timeline
banners and diff-op colours: a general status palette wearing a decision-state
name. Mapping those onto haus's feedback roles is its own change with its own
visible result.

---

## Deliberate omissions

- **No real-time collaborative editing.** ADRs are drafted by one person and
  reviewed by others. CRDT co-editing would be an impressive answer to a question
  nobody asked of this domain.
- **No email verification yet.** Fine for a single-tenant deployment; a
  prerequisite for opening sign-up. See the deployment notes below.
- **No `Add link` reference from the UI.** Composing never had one, and unifying
  the reference field on the file flow meant dropping it rather than building
  link-buffering into propose. Markdown links in the prose cover the need, and
  enough. A link sits in the sentence that needs it.
- **Auto-tracking files cited inline.** Citing a file in prose does not start
  watching it for drift. "Mentioned in an argument" is not "this decision
  governs this code", and conflating them would fill the log with drift from
  files cited as counter-examples. The gap is real: a chip in the text with no
  entry in the reference list reads as an inconsistency, and the likely answer
  is a "track this file" affordance on an untracked citation rather than doing
  it silently.

---

## Deployed

[core.hipuku.dev](https://core.hipuku.dev), on Vercel against a Neon database in
Sydney, with the functions pinned to `syd1`. That last part is not a detail: a
signed-in page load makes several queries in sequence (session, membership,
then the data) and with the compute in Virginia every one of them crossed the
Pacific. Putting them together was the single largest thing that made the
deployed app feel like the local one.

### What is switched off, and why

**Sign-up.** Not gated, absent. An invite code is a shared secret rather than
access control: whoever holds it can pass it on, and you cannot choose who ends
up with it. There is one seeded account and nothing for anyone to create.

**Writing to the decision log.** The demo account may write and save drafts,
because a draft is private to its author and holds no ADR number, so the worst a
visitor leaves behind is unfinished text. It may not accept, reject, deprecate
or supersede: that would change what the *next* visitor sees, which is not a
demo but a shared document nobody owns. Fourteen actions refuse and two do not,
enforced at the action layer because this is a property of one deployment rather
than of what a decision log is.

**GitHub linking.** The app requests the `repo` scope, which is read *and
write* on private repositories, and better-auth stores those tokens in the `account`
table. On a single-tenant deployment that is the owner's own token and their own
risk; on a public URL it would mean holding a stranger's credentials with write
access to their code, on a hobby-tier database. The feature stays in the
codebase, the tests and the docs. Only the storing of other people's tokens is
switched off.

### Browsing without holding anyone's credentials

Switching off linking would also have switched off citing files, which is the
feature most worth demonstrating. Those are separate concerns, so they are now
separated: `GITHUB_PUBLIC_TOKEN` is a read-only, public-repositories-only token
belonging to the deployment, used when the signed-in person has no account
linked, which on the demo is everyone.

It is safe to hold exactly where a user's `repo` token is not: it is the owner's
own, it cannot write, and it can reach nothing private. A linked account still
takes precedence where there is one, because it can see private repositories the
fallback cannot, and it is the person's own access.

Connecting a repository deliberately still requires your own account. Listing
"your repositories" through the deployment's token would show the *owner's*
repositories to whoever happened to be signed in.

Repository trees are cached for five minutes per instance. A tree is a few
hundred KB and changes rarely, while the picker asks for every connected repo on
every mount. Without it, a handful of visitors opening the compose screen would
spend the hourly API budget on identical answers.

### A server action should not throw

React reports a rejected server action as error #441, "an error occurred in the
Server Components render", with the message stripped out of the production
build. Anything catching it and showing the text displays React's apology as
though it were an explanation.

Every way the file picker can fail is something a person can act on: not a
member, GitHub off, no account linked, no repositories connected, GitHub
unreachable. Each is returned as words. This cost two rounds of fixing the wrong
throw to learn.

### Bounds on what a stranger can write

A draft may be empty, untitled and half-formed, which is the point of one. What
it may not be is unbounded, because `saveDraft` is reachable by anyone with a
session and on a public demo that is a scriptable way to fill a database. 128KB
per draft, 20 per author per workspace: both far above anything a person writing
a decision would reach, and low enough that the table cannot be used as free
storage.

---

# Known trade-offs / next

**~~The Postgres store is tested by nothing.~~ Done**, and this entry is kept
rather than deleted because it was the largest piece of work outstanding here
and a trade-offs list that only ever grows is not being read.

`store-contract.test.ts` runs 43 cases twice, once per store, against PGlite.
Issue #1, closed in `4dfa1a2`. The section above says what it does and does not
prove; the short version is that `drizzle-store` is no longer exercised by
nothing.

**The token layer covers colour, radius and shadow, and nothing else.** There is
no type scale and no spacing scale, so every size, weight and gap in the app is
chosen per declaration: 172 distinct raw declarations across 355 sites, eleven
font sizes between 0.72rem and 1.7rem, and seven weights including 550 and 650,
which most faces do not have. `scripts/check-token-debt.mjs` holds that number
in CI, failing in both directions, and the fix is not to invent scales here: it
is to adopt haus's, which is what this app's migration is for. The number
reaching zero is what "migrated" will mean.

**`app/app/actions.ts` is 741 lines and has no tests of its own.** It is the
security boundary, holding `requireUser` and the demo refusals. The pure helpers
have been lifted out and tested: `attempt` in `lib/attempt.ts`, and the form
readers in `lib/decisions/form.ts`. What remains inside are `snapshotFile`,
`attachCitedFiles` and `rebaselineOnAccept`, which each need GitHub and a store,
so they want fakes rather than extraction.

**Email verification is off and there is no explicit rate limiting.** Neither
matters while nobody can create an account. Both are prerequisites the moment
sign-up opens.

**The `drizzle-kit` npm-audit warnings are dev-only.** `npm audit fix --force`
destructively downgrades the migration tool. Leave them.
