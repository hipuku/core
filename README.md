# core

A decision log for a team: architecture decision records with a permission-gated lifecycle, two
audit trails, and citations to lines of code in GitHub that are checked for changes. Next.js and
React over Postgres.

**[core.hipuku.dev](https://core.hipuku.dev)** is a read-only demo, with credentials on the
sign-in page.

![The haus workspace's decision list: a draft, then HAU-005 to HAU-001 with their status badges, above the connected repositories hipuku/haus and hipuku/drift](./screenshots/decisions-list.png)

## Features

- **Lifecycle.** A decision is proposed, then accepted or rejected; an accepted one can be
  deprecated or superseded. Transitions are rows in a table, each gated by a capability. Once a
  decision leaves `proposed` its body cannot be edited, and a change means superseding it.
- **Two audit trails.** Revisions of the body are commits in a versioning engine. Status changes
  are rows in an append-only transitions table.
- **Markdown and Mermaid** in the body. `{{owner/repo:path#L47-L120}}` renders as a link to
  those lines.
- **Drift checks.** A reference to a file records its blob SHA and, when it names a line range,
  the text of those lines. When the decision is accepted the baseline moves to the code at that
  moment. A check reports whether the cited lines changed, moved or disappeared since.
- **Drafts.** Private to their author, with no ADR number, stored outside the decision table.

[FEATURE.md](./FEATURE.md) has screenshots of each screen.

## Install

```bash
cp .env.example .env.local
```

```bash
npm install
```

```bash
npm run db:push
```

```bash
npm run dev
```

`.env.local` needs `DATABASE_URL` and `BETTER_AUTH_SECRET` (`openssl rand -base64 32`). A Neon or
Supabase free-tier Postgres works for development. Nothing else is required: no Redis, queue or
third-party service. Node 22.13 or later on 22, or 24 and later (`engines`); `.nvmrc` pins 22.

## Develop

**Seed data.**

```bash
npm run db:seed
```

This creates a workspace called `haus` with five decisions: one accepted then superseded, one
accepted, one proposed and revised, one rejected, one accepted then deprecated. They include
Mermaid, inline citations, seven references (one already drifted) and a draft. Re-running
replaces the `haus` workspace and removes the older `Vault` one, and touches nothing else.

**GitHub.** Connecting repositories needs a GitHub OAuth app: set `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET`, with the callback `<BETTER_AUTH_URL>/api/auth/callback/github`, and set
`BETTER_AUTH_URL` to the port the app runs on. Browsing and citing files uses the signed-in
person's linked account, or `GITHUB_PUBLIC_TOKEN` (a read-only token for public repositories)
when there is none. Without any of these, email and password sign-in and everything except files
and repositories work.

**The public demo's configuration.** The deployment closes sign-up and shows the credentials of
one seeded account, which may save drafts and may not change the decision log. To reproduce it,
add to `.env.local`:

```bash
DISABLE_SIGNUP=1
DEMO_USER_EMAIL=demo@core.hipuku.dev
DEMO_USER_PASSWORD=read-only-demo-2026
DISABLE_GITHUB=1
```

`DISABLE_SIGNUP` makes `/sign-up` a 404 and removes its link. `DEMO_USER_*` names the account
`db:seed` creates. `DISABLE_GITHUB` hides Connect GitHub.

### Tests

```bash
npm run lint && npm run typecheck && npm test
```

```bash
npm test -- --project=domain
```

Vitest runs two projects. `domain` runs `lib/**/*.test.ts` in Node. `ui` runs the `.test.tsx`
suites in jsdom: draft autosave and recovery, the unsaved-changes guard, the compose editor's
keystrokes, the draft list and the modal shell. 342 tests in 23 files.

Domain tests use the in-memory store. Two suites check that it matches the Postgres store:

- `store-parity.test.ts` checks that both stores implement the port's 32 methods. It catches a
  method added to one store and not the other, which TypeScript does not catch when the method is
  also missing from the interface. It checks no behaviour.
- `store-contract.test.ts` runs 43 cases against both stores with the same assertions, 86 runs.
  It catches differences such as an order that only holds because a `Map` keeps insertion order,
  or a null stored differently.

The Postgres side runs on PGlite, Postgres compiled to WebAssembly and run in the test process, so
it needs no Docker, service or `DATABASE_URL`. The tables are created from the Drizzle schema on
each run.

`npm run e2e` runs four Playwright tests against a production build: sign-in, a decision's status
and history, keyboard access, and signed-out access. It pushes the schema and seeds whatever
`DATABASE_URL` points at, so that database must be disposable.

CI runs on every push to `main` and every pull request. One job runs lint, `lint:prose`,
`lint:css`, `lint:tokens`, typecheck and test, each step running even if an earlier one failed.
A production build and the e2e tests (against a Postgres service container) run after it.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run lint:prose` | Fails on a new em dash in a tracked file |
| `npm run lint:css` | Stylelint, including the hardcoded-value rule |
| `npm run lint:tokens` | Fails when the count of hardcoded declarations changes without its record |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, both projects |
| `npm run e2e` | Playwright, against a disposable database |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run db:seed` | Create the seeded `haus` workspace |
| `npm run db:studio` | Drizzle Studio |

## More

- [FEATURE.md](./FEATURE.md): the screens and what each does.
- [DESIGN.md](./DESIGN.md): the module layout, the storage port, restore as a forward commit,
  drafts, drift, the interface, the demo deployment, and known gaps.

## Stack

Next.js (App Router) · React · TypeScript · Postgres · Drizzle ORM · better-auth · haus
(`haus-tokens`, `haus-components`) · CSS Modules · Vitest · Playwright
