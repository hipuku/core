import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

/**
 * postgres-js opens connections lazily, so constructing the client without a URL
 * does not fail the build; the first query does, with a clear error. Deliberately no
 * throw at import time, which would break `next build`: it runs as production and
 * evaluates route modules before any secret is set. The client is cached on
 * globalThis so Next's dev HMR does not leak a new pool on every reload.
 */
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.client ?? postgres(connectionString ?? "", { max: 1 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
