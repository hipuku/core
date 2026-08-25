import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { decisionService } from "@/lib/decisions";

/**
 * Age out the demo account's abandoned drafts.
 *
 * On the public deployment every visitor writes as the same account, so a
 * draft — private to its author by design — is in practice shared with every
 * future visitor. Left alone, the drafts list fills with strangers' unfinished
 * sentences and stops showing the seeded one.
 *
 * Runs nightly. Does nothing anywhere DEMO_USER_EMAIL is unset, which is
 * everywhere but production.
 */

/** Long enough that someone reading the demo over an evening keeps their work. */
const MAX_AGE_HOURS = 24;

export async function GET(request: Request): Promise<Response> {
  // Vercel signs its cron requests with this header. Without the check the
  // route is a public endpoint that deletes things, which is not a thing to
  // leave lying around even when what it deletes is disposable.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const email = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  if (!email) {
    return Response.json({ skipped: "no demo account configured" });
  }

  const [demo] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (!demo) {
    return Response.json({ skipped: "demo account not found" });
  }

  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);
  const removed = await decisionService.pruneDrafts(demo.id, cutoff);

  return Response.json({ removed, olderThan: cutoff.toISOString() });
}
