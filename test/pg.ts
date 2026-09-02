import { PGlite } from "@electric-sql/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import type { DecisionsDb } from "@/lib/decisions/drizzle-store";

/**
 * A real Postgres for the contract suite.
 *
 * PGlite is Postgres itself compiled to WebAssembly and run in this process:
 * the same planner, the same types, the same constraint and transaction
 * semantics. It is not a SQL emulator, which is the whole reason it is worth
 * testing against. No Docker, no service, no `DATABASE_URL`, so the suite runs
 * in CI and on a laptop with nothing installed.
 *
 * The DDL comes from the Drizzle schema rather than from a checked-in dump, so
 * a column added to `lib/db/schema` is present here on the next run and cannot
 * drift out of step with the tables the tests write to.
 */

/** Built once. Diffing the schema costs about a second and never varies. */
let ddl: Promise<string[]> | null = null;

function schemaStatements(): Promise<string[]> {
  ddl ??= generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(schema as unknown as Record<string, unknown>),
  );
  return ddl;
}

export interface TestDb {
  db: DecisionsDb;
  /** Truncate every table. Cheaper than a fresh database between tests. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const statements = await schemaStatements();
  for (const statement of statements) await client.exec(statement);

  const db = drizzle(client, { schema }) as unknown as DecisionsDb;

  // Read the table list back out of the catalogue rather than deriving it from
  // the schema module: it is the set that actually exists, so a table added to
  // the schema is truncated without this file being touched.
  const { rows } = await client.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");

  return {
    db,
    async reset() {
      if (tables) await client.exec(`truncate ${tables} restart identity cascade`);
    },
    async close() {
      await client.close();
    },
  };
}
