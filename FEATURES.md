# Features

What core does, as built. Everything here is live — nothing in this file is
planned or partial. The reasoning behind each choice is in
[DESIGN.md](./DESIGN.md); this is the walkthrough.

---

## The lifecycle

A decision moves through a state machine held as a data table, and nothing moves
it except by matching a row in that table.

```
proposed ──accept──▶ accepted ──deprecate──▶ deprecated
   │                    │
 reject             supersede
   ▼                    ▼
rejected            superseded
```

`rejected`, `deprecated` and `superseded` are terminal — no row starts from
them. Every transition is recorded with who made it, when, and optionally why.

**Accepted decisions are immutable.** Past `proposed`, the body cannot be
edited. You supersede a decision and link its replacement; a log whose entries
can be quietly rewritten is not a log.

### Roles

Two roles, defined as bundles of capabilities rather than as checks scattered
through the code:

| | propose | edit | accept | reject | deprecate | supersede |
|---|---|---|---|---|---|---|
| **author** | ✓ | ✓ | | | | |
| **maintainer** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

An author sees no lifecycle actions at all — not disabled ones, absent ones. But
every guard returns a *reason* rather than a boolean, so where an action is
shown and refused, the interface can say why instead of failing silently.

---

## Two audit trails

Deliberately separate, because they answer different questions.

**Content history** — every revision of the body, as a structural JSON diff over
RFC 6901 pointers. Restoring an old version writes a *new* commit whose state
equals the target rather than rewinding the head: `git revert`, not `git reset`.
History stays append-only, and two people editing one document cannot silently
erase each other.

**Status history** — an append-only log of every transition, with actor, time
and reason.

Both live behind one **Activity** drawer on the decision, which carries a summary
when closed — "last activity 2 days ago · 3 events" — so you know whether
opening it is worth the click.

---

## Writing

### The editor is the document

No field fills, no borders, and type metrics matching the rendered prose
exactly, so a paragraph does not reflow between Write and Preview. The ADR's
three blocks — Context, Decision, Consequences — are marked by a left gutter
rule that takes the accent on focus. That rule is the editor's only chrome.

None of the three is labelled optional. An ADR with no context is a chat message
with a database row.

### It behaves like markdown while you type

A plain `<textarea>`, with the behaviour that makes one feel like an editor:

- **Enter continues a list** — bullets, ordered (`3.` becomes `4.`), task items,
  blockquotes, preserving indentation. Enter on an *empty* item ends the list.
- **Tab indents**, Shift+Tab outdents, across every line the selection touches.
- **⌘B / ⌘I / ⌘K / ⌘E** wrap, and unwrap if already wrapped.
- **⌘↵ submits** from anywhere in the document.
- A **toolbar** inserts the syntax in front of you, so it teaches the shortcut it
  stands in for.

All of that is pure text-in / text-out, tested directly rather than through the
DOM.

### What renders

Full markdown with GitHub extensions — headings, tables, task lists,
blockquotes, fenced code — plus **Mermaid diagrams** in ```mermaid fences,
rendered client-side with `securityLevel: strict`.

---

## Drafts

An unsent decision, parked by its author.

- **No ADR number.** Reserving one would leave permanent gaps in the sequence
  every time a draft was abandoned, and there is no way to repair a gap, because
  numbers are how people cite decisions.
- **Private to its author**, including from maintainers.
- **No transitions**, because nothing has happened to it yet.
- **No title required.** A missing one is derived from the first line actually
  written, preferring the Decision block, with markdown stripped.

### Nothing is lost

Three layers, doing different jobs:

1. **Local autosave** while composing — the net for a session that has never
   reached the server. Offered on return, never silently applied.
2. **Save as draft** — the deliberate act of parking something, visible in the
   decisions list.
3. **A navigation guard** — leaving with unsaved work asks first, and catches
   in-app navigation as well as closing the tab, because client routing never
   touches `beforeunload`.

Cancel offers three outcomes: keep editing, discard, or park it as a draft.

---

## Code references

The part that makes a decision code-aware.

### Finding a file

One search across **every connected repository at once**. Picking a repo first
was a gate in front of the only step that mattered — an author citing a file
knows the filename far more often than they know which repo it is in.

### Citing a range, not just a file

A reference may name a line span. This changes the claim from *"this file
changed"* to *"the code this decision governs changed"* — and the difference is
whether the staleness signal is worth reading. A whole-file reference drifts on
any commit touching the file, which is how a warning becomes noise.

### Citing inside the prose

`{{owner/repo:path#L47-L120}}` renders as a file chip linking to those exact
lines. Inserted with a click from the reference list, so nobody types it — but
it stays plain text on purpose, and survives being copied into a commit message
or a chat thread, which a rich-editor node would not.

### Drift

Citing a file records its blob SHA, and — where a range was given — the cited
text itself.

**The baseline moves when the decision is accepted.** A citation made while
drafting records the code the *author* was looking at; the decision does not
exist until the team accepts it. Without this, a proposal that sat in review for
a fortnight is flagged as drifted the instant it is agreed.

**Movement is not change.** Insert twenty lines above a cited block and it is
untouched but now lives elsewhere. The stored text is searched for before
anything is called drift, and a block found intact has its range updated to
follow it. Trailing whitespace is normalised away, so a formatter run is not
drift; changed indentation *is*, because it means the block changed scope.

Three outcomes: **in sync**, **changed**, **missing** — reported on the
document, where you would decide whether to act, and never while writing, where
a file cited moments ago can only be in sync.

---

## Workspaces

Each has its own membership, its own connected repositories, and its own ADR
numbering — a Jira-style key derived from the name, so decisions read as
`VAU-001`. The key is editable; the numbers are not.

Maintainers manage members, repositories and the workspace itself from a
settings page. Numbers are assigned inside the same transaction that creates the
decision, so two simultaneous proposals cannot take the same one.

---

## The public demo

[core.hipuku.dev](https://core.hipuku.dev) runs the same code with three
deployment flags set.

**No sign-up.** Not a gated one — an invite code is a shared secret, not access
control, since whoever holds it can pass it on. The page does not exist.

**One read-only account**, credentials on the sign-in page. It may write and
save drafts; it may not change the decision log. A draft is private and holds no
number, so the worst a visitor leaves behind is unfinished text — where
accepting a seeded decision would change what the next visitor sees.

**No GitHub linking.** The app requests the `repo` scope, which is read *and
write* on private repositories, and a public deployment holding a stranger's
token with that reach is not a risk worth taking for a demo. File browsing still
works, through a read-only public-repositories token belonging to the
deployment — safe to hold exactly where a user's would not be.

Running it locally has none of these restrictions. See the
[README](./README.md).

---

## Deliberately not built

- **Real-time collaborative editing.** ADRs are drafted by one person and
  reviewed by others. CRDT co-editing would be an impressive answer to a
  question this domain does not ask.
- **A `draft` lifecycle status.** See above — drafts are their own table.
- **Adding link references from the UI.** Composing never had it, and unifying
  the reference field on the file flow meant dropping it rather than building
  link-buffering into propose. A markdown link in the sentence that needs it
  beats a link in a list.
- **Auto-tracking files cited inline.** Citing a file in prose does not start
  watching it for drift. "Mentioned in an argument" is not "this decision governs
  this code", and conflating them would fill the log with drift from files cited
  as counter-examples.
