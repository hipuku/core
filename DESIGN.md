# DESIGN.md for core

## Context

core is the portfolio's range slot: the one project outside design tooling. A
signed-in, multi-user product aimed at Atlassian's problem space — workflow,
permissions, audit trail — rather than at design systems.

The domain is a **team decision log**: architecture decision records with a
lifecycle. The centrepiece is the lifecycle state machine plus permission-gated
transitions and the supersession graph, chosen over real-time collaborative
editing because it is product-true (ADRs are drafted by one person and reviewed
by others, not co-typed) and because it is the more legible axis for the
audience.

**North star:** governed design documents connected to the code they govern.
Notion holds the document but not the governance; Jira holds the workflow but is
not a document. The gap is a document that carries its own governance and knows
about the code it decided.

---

## Standing decisions

### core depends on no local package

Not `haus-components`, not `haus-tokens`, not anything else in the portfolio. Its
independence is the point — it is the range slot, and coupling it to a library
under active development would undermine exactly what it exists to show. It has
its own CSS and its own visual language.

### Storage is a port, never a dependency

Both engines depend on a store *interface*. `memory-store` and `drizzle-store`
implement the same contract, so the test suite exercises real domain behaviour
rather than mocks, and swapping storage changes where data lives and nothing
about how the domain behaves.

The two writes that must not tear — a decision and its opening transition, a
status change and its audit row — are single methods on that interface, so the
Drizzle implementation can wrap each in one transaction.

### Restore is a forward commit

Restoring an old version writes a new commit whose state equals the target,
rather than rewinding the head. `git revert`, not `git reset`. History stays
append-only and auditable, a restore is itself a versioned event, and multiple
people editing one document cannot silently erase each other's history.

### Two audit trails, deliberately separate

Content revisions live in the versioning engine; status transitions live in an
append-only `decision_transitions` log. "How did the text change" and "how did
the decision move" are different questions asked by different people at different
times, and collapsing them into one timeline would answer neither well.

### Accepted decisions are immutable

Past `proposed`, the body cannot be edited. You supersede a decision and link the
replacement. A decision log whose entries can be quietly rewritten is not a log.

### Guards return a reason rather than throwing

Every lifecycle check returns `{ ok: false, reason }`. The UI can then say *why*
an action is unavailable instead of hiding it, which is the difference between a
permission system people understand and one they resent.

---

## Drafts

A draft is **not a lifecycle status**, and lives in its own table.

- It holds **no ADR number**. Reserving one would leave permanent gaps in the
  sequence every time a draft is abandoned — and gaps in a numbered audit trail
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
server — the browser dies twenty minutes in and there is nothing in any list to
recover from. A **server draft** is the deliberate act of parking something, and
appears in the decisions list. Once a server draft exists the local copy is
disabled, because the list is the better recovery route.

A found local draft is **offered, never applied**. Silently replacing what
someone sees on screen with older text is its own kind of data loss.

---

## Code references and drift

### A citation names a range, not just a file

A whole-file reference drifts on any commit touching the file, so a typo in an
unrelated function marks the decision stale. False positives scale with file
size, and a staleness signal that cries wolf gets ignored — which defeats the
entire feature. Citing lines 47–120 changes the claim from "this file changed"
to "the code this decision governs changed".

### Movement is not change

The cited text is stored alongside the range. When a range no longer matches, the
text is searched for elsewhere in the file before anything is called drift —
insert twenty lines above a block and it is untouched but now lives at 67–140.
Trailing whitespace is normalised away, so a formatter run is not drift; changed
indentation *is* drift, because it means the block changed scope.

### The baseline moves when the decision is accepted

A citation made while drafting records the code the *author* was looking at. The
decision does not exist until the team accepts it, so that is when its reference
point should be fixed. Without this, a proposal that sat in review for a
fortnight is flagged as drifted the instant it is agreed.

A block that moved during review is *followed* rather than re-pinned — pinning
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
it survives being copied into a commit message or a chat thread — which a rich
editor node would not. Tokens are rewritten into ordinary markdown links before
parsing, so the renderer needs no plugin and inherits the escaping that
react-markdown has already hardened. An unresolvable token renders as inline code
rather than vanishing, so a typo is visible instead of silently swallowed.

---

## Interface

### Writing and reading are the same surface

The compose editor carries no field fills, no borders, and type metrics matching
the rendered prose exactly, so a paragraph does not reflow between Write and
Preview. The ADR's structure survives as a left gutter rule that takes the accent
on focus — the editor's only chrome. Preview is then a check on rendering rather
than a mode you have to live in.

The editor is a plain `<textarea>` by choice: no CodeMirror, no contenteditable,
no third-party editor to keep in sync with how the document later renders. What
makes it *feel* like markdown is behaviour while typing — lists that continue
themselves, Tab that indents, wrapping shortcuts — and all of that is pure
text-in / text-out, tested directly.

### Editing is a page, not a mode

Inline editing left the properties, the notices and the tabs stacked above the
editor, with two Edit affordances visible at once. Writing deserves the same
undistracted page whether the document is new or already numbered.

### Only the document is paper

The decision page had grown five cards across three widths, two grounds and two
elevations, and nothing said which surface mattered. One white sheet holds the
document; everything else — properties, notices, tabs — is annotation about it
and sits on the desk. Every region shares the sheet's measure, so the page has
two vertical edges rather than six.

The **dossier** card is the exception that proves it: status, owner and dates
*are* the current state of a decision's history, so the audit trail expands
inside the card that summarises it rather than beside it.

### Notices are tinted, never elevated

Raising a notice puts it in competition with the sheet. What makes a notice
urgent is what it says, not how far off the page it floats. Only one notice
survives — the drift warning; everything else that used to be a banner is a
property, because state and authorship are facts about the record rather than
warnings about it.

### Two button families

`.btn` is a labelled action on the page, and every one carries a background — a
transparent button with a word in it reads as a link, and a row mixing filled and
unfilled controls has no rhythm. There is no ghost variant: the default *is* the
quiet one, quiet by being the lightest fill rather than by being absent. One
filled accent per view; Approve keeps its own green, because it says "yes, and
permanently" in a way an accent that also means "primary" and "link" cannot.

`.iconbtn` is an icon-only affordance inside a container — the × on a row, a
formatting tool, a refresh beside a timestamp. Those fill on hover only, because
eight filled squares in a toolbar is noise, and because they belong to the thing
they sit in rather than to the page.

### One file token, two arrangements

A path rendered four different ways looked like a different kind of object
depending on the screen. A **chip** sits inside a line of text and carries the
filename only, because a full path cannot sit mid-sentence. A **row** sits in a
list, carries the whole path, and offers a slot on the right for what that list
needs — a drift badge, a remove control, a range picker.

### Visual language

Notion-inspired warm paper: an off-white desk, white cards separated by fill
rather than borders, Gabarito for type. Colour is drawn from a retro-print
palette — vermilion, mustard, teal, cobalt — saturated but medium-lightness
"ink", never neon, and used only where it earns its place. No monospace except
for code, paths and diffs.

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
  arguably better — a link in the sentence that needs it beats a link in a list.
- **The `drizzle-kit` npm-audit warnings are dev-only.** `npm audit fix --force`
  destructively downgrades the migration tool. Leave them.

---

## Deploying

Not yet deployed. Three things must be settled first, and one of them is not
optional.

**The GitHub scope.** The OAuth app requests `repo` — full read *and write* on
private repositories — and better-auth stores those tokens in the `account`
table. On a single-tenant deployment that is the owner's own token and their own
risk. On a public URL where strangers connect their GitHub, it means holding
third-party credentials with write access to their private code. Either drop to
`public_repo`, move to a GitHub App with fine-grained read-only Contents
permission, or disable GitHub linking on the public deploy. The GitHub app's
"Expire user access tokens" option is currently **off**, which is fine for
development and wrong for production.

**Sign-up must be gated.** No email verification, no invite gate, no explicit
rate limiting. A public URL with open sign-up fills with bot accounts.

**A read-only demo account** is what actually sells the project. Nobody
evaluating this will sign up, create a workspace and write three ADRs; they need
to land on a workspace with real decisions, real history and a real drift state
in five seconds. Seed one and print its credentials on the sign-in page.

Then: private GitHub repo, Vercel, the Neon `DATABASE_URL` and
`BETTER_AUTH_SECRET` as env, `BETTER_AUTH_URL` set to the production origin, and
the production OAuth callback added to the GitHub app.
