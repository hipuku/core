# core

A team decision log. Architecture decision records with a lifecycle, permissions,
two audit trails, and a link to the code they govern — so a decision can tell you
when the thing it decided has changed underneath it.

The wedge: Notion holds the document but not the governance, Jira holds the
workflow but is not a document. core is a governed document that knows about
code.

## What it does

- **Propose → accept → deprecate / supersede**, as a state machine with
  permission-gated transitions. Accepted records are immutable: you supersede
  them, you do not edit them.
- **Two audit trails.** Content revisions live in a versioning engine; status
  transitions live in their own append-only log. "How did the text change" and
  "how did the decision move" are different questions, and are stored as such.
- **Markdown and Mermaid** in the body, with inline file citations —
  `{{owner/repo:path#L47-L120}}` renders as a link to the exact lines.
- **Staleness detection.** Citing a file records the code as it stands; the
  baseline moves to what the team agreed when the decision is accepted, and a
  drift check tells you whether the cited code has changed since. A citation can
  name a line range, so drift means *this code* changed rather than *this file*
  was touched.
- **Drafts.** Unsent decisions, private to their author, holding no ADR number.

## Architecture

```
lib/versioning/     append-only document history — pure, tested, domain-agnostic
  diff.ts             structural JSON diff over RFC 6901 pointers
  engine.ts           snapshot / commit / restore / history over a storage port
  memory-store.ts     in-memory VersionStore (tests)
  drizzle-store.ts    Postgres-backed VersionStore (same interface)

lib/decisions/      the domain
  lifecycle.ts        the state machine as a data table, capability-gated
  service.ts          orchestration over lifecycle + versioning + a store port
  snippet.ts          comparing a cited *range* of a file, and finding it if it moved
  citation.ts         the {{repo:path#lines}} token
  drift.ts            where a reference stands relative to the code it cited
  key.ts              per-workspace ADR keys (VAU-001)
  memory-store.ts     in-memory DecisionStore (tests)
  drizzle-store.ts    Postgres-backed DecisionStore (same interface)

lib/markdown/       textarea editing behaviour — lists, indent, wrapping
lib/db/             Drizzle schema and client
lib/github.ts       repo trees, file contents, blob SHAs
```

Both engines depend on a **store interface**, never on Drizzle. The in-memory
store and the Postgres store implement the same contract, so the suite exercises
real behaviour and swapping storage changes where data lives and nothing about
how the domain behaves.

### Why restore is a forward action

Restoring an old version writes a **new** commit whose state equals the target,
rather than rewinding the head. History stays append-only and auditable — a
restore is itself a versioned event you can see and undo. This is `git revert`,
not `git reset`, and it is the only design that survives multiple people editing
one document without one silently erasing another's history.

### Why a draft is not a status

A draft holds no ADR number, because reserving one would leave permanent gaps in
the sequence every time a draft is abandoned, and gaps in a numbered audit trail
are exactly the wrong kind of mystery. It is also private to its author, where
every real status is workspace-visible, and it has no transitions, because
nothing has happened to it yet. Drafts live in their own table so the status enum
stays an honest description of a decision's life.

More of this reasoning is in [DESIGN.md](./DESIGN.md).

## Getting started

```bash
cp .env.example .env.local   # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:push              # create the tables
npm run dev
```

A free [Neon](https://neon.tech) or Supabase Postgres works for local
development. Generate the auth secret with `openssl rand -base64 32`.

**GitHub is optional.** Without `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`,
everything works except connecting a repository and citing files from it — sign
up with email and password and the rest of the product is there. To enable it,
register an OAuth app at github.com/settings/developers with the callback
`<BETTER_AUTH_URL>/api/auth/callback/github`, and set `BETTER_AUTH_URL` to
whatever port you are actually running on.

## Scripts

| Script              | What it does                             |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Next dev server                          |
| `npm run build`     | Production build (typechecks)            |
| `npm test`          | Vitest — the domain and text-core suites |
| `npm run lint`      | eslint                                   |
| `npm run db:push`   | Push the Drizzle schema to the database  |
| `npm run db:studio` | Drizzle Studio                           |

## Tests

Every pure module has its own suite, exercised directly rather than through a
component. The two storage ports are covered by running the in-memory store
against the same tests the domain relies on.

```
npm test
```

## Stack

Next.js (App Router) · React · TypeScript · Postgres · Drizzle ORM ·
better-auth · Vitest. No Tailwind — CSS modules and a small token layer in
`app/globals.css`.
