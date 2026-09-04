import { spawn } from "node:child_process";

/**
 * Puts the schema and the seed into whatever DATABASE_URL points at.
 *
 * That database must be disposable: this pushes a schema and writes fixture
 * users over whatever is there. CI supplies a Postgres service container;
 * locally, point it at a scratch database, never a shared one.
 *
 * PGlite behind a socket was tried first, so the suite would need no Docker at
 * all, the way `test/pg.ts` needs none. It got as far as serving queries and
 * then failed under a real app: `PGLiteSocketServer` takes one connection at a
 * time, and Next plus better-auth open more, which surfaced as ECONNRESET and a
 * 500 from the session lookup. In-process PGlite remains right for the store
 * contract and is not enough for an application under test.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. The end-to-end suite needs a disposable Postgres:\n" +
        "  docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17\n" +
        "  DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run e2e",
    );
  }

  const run = (cmd: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      const p = spawn(cmd, args, { stdio: "inherit", env: process.env });
      p.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
      );
    });

  // push, not migrate: the schema is the source of truth and this database is
  // thrown away, so there is no history for a migration to protect.
  await run("npx", ["drizzle-kit", "push", "--force"]);
  await run("npx", ["tsx", "scripts/seed.ts"]);
}
