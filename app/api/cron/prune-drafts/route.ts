import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { decisionService } from "@/lib/decisions";

/**
 * Age out the demo account's abandoned drafts.
 *
 * On the public deployment every visitor writes as the same account, so a
 * draft, private to its author by design, is in practice shared with every
 * future visitor. Left alone, the drafts list fills with strangers' unfinished
 * sentences and stops showing the seeded one.
 *
 * Runs nightly. Does nothing anywhere DEMO_USER_EMAIL is unset, which is
 * everywhere but production.
 */

/** Long enough that someone reading the demo over an evening keeps their work. */
const MAX_AGE_HOURS = 24;

export async function GET(request: Request): Promise<Response> {
  const email = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  const secret = process.env.CRON_SECRET;

  // Vercel signs its cron requests with this header. Without the check the
  // route is a public endpoint that deletes things, which is not a thing to
  // leave lying around even when what it deletes is disposable.
  //
  // A missing secret refuses rather than skipping the check. The route only has
  // work to do where DEMO_USER_EMAIL is set, which is production, and that is
  // exactly where an unset CRON_SECRET would turn the guard off. Deleting
  // nothing for a night is recoverable; a public delete endpoint is not.
  if (email && !secret) {
    console.error("[prune-drafts] refused: CRON_SECRET is not configured");
    return Response.json({ error: "not configured" }, { status: 500 });
  }
  if (secret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      console.warn("[prune-drafts] refused an unauthorised request");
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!email) {
    // Logged, not just returned. Vercel's log viewer shows console output
    // rather than response bodies, so a scheduled job that only returns its
    // result leaves no trace of what it did, and nobody watches a cron run.
    console.log("[prune-drafts] skipped: no demo account configured");
    return Response.json({ skipped: "no demo account configured" });
  }

  const [demo] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (!demo) {
    console.log(`[prune-drafts] skipped: no account for ${email}`);
    return Response.json({ skipped: "demo account not found" });
  }

  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);
  const removed = await decisionService.pruneDrafts(demo.id, cutoff);

  console.log(
    `[prune-drafts] removed ${removed} draft${removed === 1 ? "" : "s"} ` +
      `older than ${cutoff.toISOString()}`,
  );
  return Response.json({ removed, olderThan: cutoff.toISOString() });
}
