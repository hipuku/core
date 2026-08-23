# core

A signed-in, multi-user product built on Next.js and Postgres, with an
**append-only version history** — snapshot, diff, restore — as its engineering
centrepiece.

The domain it applies that history to is deliberately still open. Everything in
this repo is built so the answer to "what is core?" plugs into a spine that is
already real: the state a document holds is arbitrary JSON, and the versioning
core neither knows nor cares what it means.

## Architecture

```
lib/versioning/     the centrepiece — pure, tested, domain-agnostic
  types.ts            Json state, documents, versions, changes
  diff.ts             structural JSON diff over RFC 6901 pointers
  engine.ts           snapshot / restore / history over a storage port
  memory-store.ts     in-memory VersionStore (tests, demos)
  drizzle-store.ts    Postgres-backed VersionStore (same interface)
lib/db/             Drizzle schema and client
lib/auth.ts         better-auth (email + password to start)
app/api/auth/       better-auth route handler
```

The engine depends on a `VersionStore` **interface**, never on Drizzle directly.
The in-memory store and the Postgres store implement the same contract, so the
test suite exercises real engine behaviour and swapping storage changes where the
data lives and nothing about how versioning behaves.

### Why restore is a forward action

Restoring an old version writes a **new** commit whose state equals the target,
rather than rewinding the head. History stays append-only and auditable — a
restore is itself a versioned event you can see and undo. This is `git revert`,
not `git reset`, and it is the only design that survives multiple users editing
one document without one silently erasing another's history.

## Getting started

```bash
cp .env.example .env.local   # then fill in DATABASE_URL and BETTER_AUTH_SECRET
npm run db:push              # create the tables
npm run dev
```

A free Neon or Supabase Postgres works for local development. Generate the auth
secret with `openssl rand -base64 32`.

## Scripts

| Script              | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Next dev server                         |
| `npm run build`     | Production build (typechecks)           |
| `npm test`          | Vitest — the versioning engine's suite  |
| `npm run db:push`   | Push the Drizzle schema to the database |
| `npm run db:studio` | Drizzle Studio                          |

## Stack

Next.js · React · TypeScript · Postgres · Drizzle ORM · better-auth · Vitest.
