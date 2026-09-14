# Features

The screens of core and what each does. [DESIGN.md](./DESIGN.md) records why.

---

## Workspaces

![The workspaces list, showing the haus workspace with one decision awaiting review and its counts of decisions, members and connected repositories](./screenshots/home.png)

A workspace has its own members, connected repositories and ADR numbering. Its key is derived
from the name: initials for several words ("Platform team" is `PT`), the first three letters for
one ("Vault" is `VAU`). The key can be changed in settings; decision numbers cannot.

Each row shows the number of decisions awaiting review, and the counts of decisions, members and
repositories.

---

## The decision log

![The haus workspace's decision list: a draft, then HAU-005 to HAU-001 with their status badges, above the connected repositories hipuku/haus and hipuku/drift](./screenshots/decisions-list.png)

Every decision, newest first, with its key and status. The line under the title names the
signed-in person's role in the workspace.

Status badges use haus `Badge` tones: proposed is info, accepted success, rejected error,
deprecated warning, superseded primary. Superseded is not error because a superseded decision was
valid until it was replaced.

---

## The lifecycle

```
proposed ──accept──▶ accepted ──deprecate──▶ deprecated
   │                    │
 reject             supersede
   ▼                    ▼
rejected            superseded
```

The four transitions are rows in a table (`lib/decisions/lifecycle.ts`). `rejected`,
`deprecated` and `superseded` have no outgoing row, so they are terminal. Each transition is
stored with its actor, time and an optional reason.

Once a decision leaves `proposed`, its body cannot be edited. Changing an accepted decision means
writing a new one and superseding the old one with it; the new decision must already be accepted.

### Roles

| | propose | edit | accept | reject | deprecate | supersede |
|---|---|---|---|---|---|---|
| **author** | ✓ | ✓ | | | | |
| **maintainer** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Roles are lists of capabilities. An author is shown no lifecycle actions. Each check returns
`{ ok: false, reason }` when it refuses, so the interface can show the reason.

---

## Reviewing a proposal

![HAU-003, proposed by the author Priya, with Edit, Reject and Approve in the header and the dossier card showing status, owner, created and last-edited dates](./screenshots/decision-accept.png)

A maintainer sees Edit, Reject and Approve on a proposed decision. Approve is green. Approve,
Reject and Deprecate each open a confirmation whose primary button has the same tone as the button
that opened it. Supersede opens its own dialog, to choose the replacement.

The dossier card shows status, owner, created and last-edited dates, and who accepted the
decision.

---

## Two audit trails

**Content history.** Each revision of the body is a commit, shown as a structural JSON diff over
RFC 6901 pointers. Restoring a version writes a new commit whose content equals it, as
`git revert` does, so no commit is removed.

**Status history.** Every transition, with actor, time and reason.

Both are in the Activity drawer. Closed, it shows when the last event was and how many events
there are, for example "Last activity 5 days ago · 3 events".

---

## Writing

![The compose editor on a draft: the Write and Preview switch, the markdown toolbar, the title, and the Context and Decision sections marked by a left gutter rule](./screenshots/decision-writing.png)

### The editor

The editor has no field backgrounds or borders, and its type metrics match the rendered markdown,
so text does not reflow between Write and Preview. The three sections, Context, Decision and
Consequences, are marked by a rule in the left gutter that takes the accent colour on focus. None
is marked optional.

### Keyboard

The editor is a `<textarea>`. Its editing behaviour is in `lib/markdown/editing.ts`, as functions
from text and selection to text and selection, tested without a DOM.

- **Enter** continues a bulleted, numbered (`3.` then `4.`) or task list, or a blockquote, keeping
  the indentation. Enter on an empty item ends the list.
- **Tab** indents and **Shift+Tab** outdents every line the selection touches.
- **⌘B, ⌘I, ⌘K, ⌘E** (Ctrl on other platforms) wrap the selection, or unwrap it if already
  wrapped.
- **⌘Enter** submits.
- The toolbar inserts the same syntax as the shortcuts.

### Rendering

![HAU-002's Decision section: a Mermaid diagram of haus's token layers, then a task list whose first item carries an inline file citation chip](./screenshots/decision-links-mermaid.png)

GitHub-flavoured markdown (tables, task lists, blockquotes, fenced code) and Mermaid diagrams in
` ```mermaid ` fences, rendered in the browser with `securityLevel: "strict"`.

---

## Drafts

- **No ADR number.** Numbers are assigned when a decision is proposed.
- **Private to the author**, maintainers included.
- **No transitions.**
- **No title required.** A missing title is taken from the first line written, preferring the
  Decision section, with markdown removed.

### Recovering unsaved work

1. **Local autosave** to `localStorage` while composing a decision that has no server draft.
   Found on return, it is offered, and applied only when accepted.
2. **Save as draft** stores it on the server, and it appears in the decisions list. Local autosave
   stops for that session.
3. **A navigation guard** asks before leaving with unsaved changes, for in-app navigation as well
   as closing the tab.

Cancel offers three choices: keep editing, discard, or save as draft.

---

## Code references

### Finding a file

The file search covers every repository connected to the workspace at once.

### Citing a range

A reference can name a line range. A whole-file reference is marked changed by any commit that
touches the file; a range is marked changed only when those lines change.

### Citing in the text

`{{owner/repo:path#L47-L120}}` renders as a file chip linking to those lines on GitHub. It can be
inserted from the reference list or typed. A token that does not resolve renders as inline code.

### Drift

![HAU-002, accepted, with the lineage row HAU-001 to HAU-002 and a tinted "Referenced code has changed" notice above the document](./screenshots/decision-deprecate.png)

A file reference records the file's blob SHA and, for a range, the cited text.

When a decision is accepted, each reference's baseline moves to the code at that moment, so
changes made while the proposal was in review are not reported as drift.

When the cited text is no longer at its lines, the file is searched for it. Found unchanged
elsewhere, the reference's range moves to the new lines. Trailing whitespace is ignored; changed
indentation counts as a change.

A file reference is **synced**, **drifted** or **missing**. A link reference, or a file reference
with no baseline, is **unknown** and shows no status. Status is shown when reading a decision,
not while composing it.

---

## Supersession and lineage

![HAU-001, superseded, with the lineage row HAU-001 followed by an arrow to HAU-002, above the start of its body](./screenshots/decision-supersede.png)

The lineage row shows every decision in the chain, before and after the current one.

---

## Settings

![The workspace settings page: general fields for name and decision key, the members list with role badges, and the connected repositories](./screenshots/settings.png)

Maintainers edit the workspace name and key, members and connected repositories on one page. The
key field shows the labels it will produce.

A decision's number is assigned in the transaction that creates it, and a unique constraint on
workspace and number rejects a duplicate. When two proposals take the same number at once, the
second retries with the next one (`lib/decisions/retry.ts`).

---

## The public demo

[core.hipuku.dev](https://core.hipuku.dev) runs the same code with these settings:

- **No sign-up.** `/sign-up` is a 404.
- **One shared account**, with its credentials on the sign-in page. It can save and discard
  drafts. It cannot create, edit or delete workspaces, change members, repositories or
  references, propose, revise, change a status, supersede, or re-check drift. Every visitor uses this account, so its drafts are shared
  between visitors. A nightly job deletes its drafts not updated in 24 hours and restores the
  seeded draft if it is gone.
- **No GitHub linking.** The OAuth flow requests the `repo` scope, which allows writing to private
  repositories, and the demo does not store those tokens. File browsing uses a read-only token for
  public repositories.

Locally, none of these apply. See the [README](./README.md).

---

## Not built

- **Real-time collaborative editing.** ADRs are written by one person and reviewed by others.
- **A `draft` lifecycle status.** Drafts have their own table.
- **Adding a link reference from the interface.** A markdown link in the body does the same job.
- **Tracking files cited inline.** A citation in the text is not added to the references checked
  for drift, because a file cited as a counter-example is not governed by the decision.
