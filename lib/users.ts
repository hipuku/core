import { inArray } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

/**
 * User identity lives in better-auth's `user` table, an auth concern. Keeping these
 * lookups here rather than in the decision store keeps that store free of the auth
 * schema. The decision domain deals only in user ids.
 */
export async function findUserByEmail(email: string): Promise<UserSummary | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

/** Resolve a set of user ids to their name/email, keyed by id. */
export async function usersById(ids: string[]): Promise<Map<string, UserSummary>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}
