import { DecisionError } from "@/lib/decisions";
import type { ActionResult } from "./action-result";

/**
 * Run a mutation and turn the failures a person can act on into a result the
 * toast can show.
 *
 * Two kinds are expected here: a DecisionError, which is a guard refusing with
 * its reason, and a GitHub failure, which is an outage or a permission the
 * person can do something about. Anything else is a bug and rethrows, because a
 * result that reports every failure as a sentence hides the ones nobody has
 * looked at yet.
 *
 * Lives here rather than in the actions file so the mapping is testable without
 * a request: a server action module may only export async functions, so a
 * helper defined in one is unreachable from a test. And here rather than in
 * action-result.ts, which holds only the type and is imported by three client
 * components. Their `import type` is erased at compile time, but a value
 * exported from that module would put the decisions graph, and postgres with
 * it, one careless import away from a browser bundle.
 */
export async function attempt(
  run: () => Promise<void>,
  ok: string,
): Promise<ActionResult> {
  try {
    await run();
  } catch (e) {
    if (e instanceof DecisionError) return { error: e.message };
    if (e instanceof Error && e.message.startsWith("GitHub")) {
      return { error: e.message };
    }
    throw e;
  }
  return { ok };
}
