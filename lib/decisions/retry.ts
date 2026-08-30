/**
 * Retry a write that lost a race for a unique value.
 *
 * ADR numbers are `max(number) + 1` computed in the application. Under Postgres
 * READ COMMITTED two concurrent proposals in one workspace can read the same
 * max, and the unique constraint on (workspace_id, number) then refuses the
 * second insert. The constraint is the integrity guarantee and stays; this is
 * what turns the loser into a success rather than an error the author sees.
 *
 * Separated from the store so the retry itself is testable without a database:
 * the case worth asserting is how many times it tries and what it does when the
 * conflict does not clear, neither of which needs Postgres to observe.
 */

/** Postgres unique violation. */
const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; constraint_name?: unknown };
  if (e.code !== UNIQUE_VIOLATION) return false;
  if (!constraint) return true;
  return e.constraint_name === constraint;
}

export interface RetryOptions {
  /** Total attempts, including the first. */
  attempts?: number;
  /** Only errors this matches are retried; anything else propagates untouched. */
  retryable?: (error: unknown) => boolean;
}

/**
 * Run `work`, retrying while `retryable` says the failure was a lost race.
 *
 * The last failure is rethrown rather than replaced, so an exhausted retry
 * reports the constraint that actually refused it instead of a message this
 * function invented.
 */
export async function withRetry<T>(
  work: () => Promise<T>,
  { attempts = 3, retryable = () => false }: RetryOptions = {},
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (!retryable(error)) throw error;
      last = error;
    }
  }
  throw last;
}
