# core

A team decision log: architecture decision records with a lifecycle,
permissions, two audit trails, and a link to the code they govern, so a decision
can tell you when the thing it decided has changed underneath it. Next.js and
React over Postgres.

**[core.hipuku.dev](https://core.hipuku.dev)** is a read-only demo, with
credentials on the sign-in page.

![A workspace's decision list: five decisions with keys VAU-001 to VAU-005, each showing a status pill, above the connected repositories](./screenshots/decisions-list.png)

Notion holds the document but not the governance. Jira holds the workflow and is
not a document. core is a governed document that knows about the code it
decided.

## Features

- **Propose, accept, deprecate or supersede**, as a state machine with
  permission-gated transitions. Accepted records are immutable, and you supersede
  them to change one.
- **Two audit trails.** Content revisions live in a versioning engine; status
  transitions live in their own append-only log. How the text changed and how the
  decision moved are different questions, and are stored as such.
- **Markdown and Mermaid** in the body, with inline file citations.
  `{{owner/repo:path#L47-L120}}` renders as a link to the exact lines.
- **Staleness detection.** Citing a file records the code as it stands, the
  baseline moves to what the team agreed when the decision is accepted, and a
  drift check reports whether the cited code has changed since. A citation can
  name a line range, so drift means the cited lines changed.
- **Drafts.** Unsent decisions, private to their author, holding no ADR number.

The full walkthrough is in [FEATURE.md](./FEATURE.md).

## Install

```bash
cp .env.example .env.local   # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:push              # create the tables
npm run dev
```

A free [Neon](https://neon.tech) or Supabase Postgres works for local
development. Generate the auth secret with `openssl rand -base64 32`.

Nothing else is needed. No Redis, no queue, no third-party service. Node,
Postgres and a browser.

## Develop

**Seed some data.** An empty decision log demonstrates nothing:

```bash
npm run db:seed
```

That builds a workspace with five decisions across the whole lifecycle, a
supersession, two revisions of one record, markdown and Mermaid, a parked draft,
and a reference that has already drifted. It is idempotent by workspace name:
re-running replaces what it created and touches nothing else.

**GitHub is optional.** Without `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`,
everything works except connecting a repository and citing files from it. Sign up
with email and password and the rest of the product is there. To enable it,
register an OAuth app at github.com/settings/developers with the callback
`<BETTER_AUTH_URL>/api/auth/callback/github`, and set `BETTER_AUTH_URL` to
whatever port you are actually running on.

**Before committing:**

```bash
npm run lint && npm run typecheck && npm test
npm test -- --project=domain     # just the fast ones
npm test -- --project=ui
```

Two vitest projects, because the suites have different needs. `domain` runs in
Node: every pure module has its own suite, exercised directly rather than through
a component. `ui` runs in jsdom and covers what is only observable in a browser,
which is draft autosave and recovery, the unsaved-navigation guard, and the
compose editor's markdown keystrokes reaching the caret.

The domain suite runs against the in-memory store. The Postgres store implements
the same port and is checked against it structurally: see [DESIGN.md](./DESIGN.md)
for what that does and does not prove.

CI runs lint, typecheck and test on every push and pull request, then a
production build once they agree. Each check reports independently, so one run
tells you everything that is wrong rather than only the first thing.

## Scripts

| Script              | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Next dev server                         |
| `npm run build`     | Production build                        |
| `npm run lint`      | eslint                                  |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm test`          | Vitest, the domain and ui suites        |
| `npm run db:push`   | Push the Drizzle schema to the database |
| `npm run db:seed`   | Populate a workspace worth looking at   |
| `npm run db:studio` | Drizzle Studio                          |

## More

[FEATURE.md](./FEATURE.md) walks through what the product does.
[DESIGN.md](./DESIGN.md) covers the architecture, the storage port, why restore
is a forward action, why a draft is not a status, and what is deliberately left
out.

## Stack

Next.js (App Router) · React · TypeScript · Postgres · Drizzle ORM ·
better-auth · Vitest. No Tailwind: CSS modules and a small token layer in
`app/globals.css`.
