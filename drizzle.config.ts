import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/**
 * `.env.local` is a Next.js convention: Next loads it, drizzle-kit does not,
 * so `db:push` sees an empty `DATABASE_URL` and refuses. Load it here rather
 * than duplicating the connection string into a second file drizzle-kit does
 * read: one source of truth, and the credentials stay in the gitignored file.
 */
function loadEnvLocal(): void {
  let contents: string;
  try {
    contents = readFileSync(new URL(".env.local", import.meta.url), "utf8");
  } catch {
    return; // Absent in CI and on a deployed host, where the env is already set.
  }

  for (const line of contents.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    // A real environment variable always wins over the file.
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue!.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Fill it in .env.local (see .env.example).");
}

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
