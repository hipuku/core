import { describe, expect, it, vi } from "vitest";
import { isUniqueViolation, withRetry } from "./retry";

describe("isUniqueViolation", () => {
  it("recognises a Postgres unique violation", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("ignores every other Postgres error", () => {
    // 23503 is a foreign key violation: also a constraint, never a lost race.
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("ignores errors that are not database errors at all", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it("narrows to one constraint when asked", () => {
    const error = { code: "23505", constraint_name: "decisions_workspace_number_key" };
    expect(isUniqueViolation(error, "decisions_workspace_number_key")).toBe(true);
    // A different unique constraint is a different bug and must not be retried.
    expect(isUniqueViolation(error, "workspace_repos_key")).toBe(false);
  });
});

describe("withRetry", () => {
  const conflict = { code: "23505", constraint_name: "decisions_workspace_number_key" };
  const retryable = (e: unknown) => isUniqueViolation(e);

  it("returns the first result when nothing fails", async () => {
    const work = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(work, { retryable })).resolves.toBe("ok");
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("succeeds on the retry after losing one race", async () => {
    const work = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValue("second");
    await expect(withRetry(work, { retryable })).resolves.toBe("second");
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("gives up after the attempt limit and rethrows the last failure", async () => {
    const work = vi.fn().mockRejectedValue(conflict);
    await expect(withRetry(work, { attempts: 3, retryable })).rejects.toBe(conflict);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it("does not retry an error the caller did not name", async () => {
    const other = new Error("connection reset");
    const work = vi.fn().mockRejectedValue(other);
    await expect(withRetry(work, { retryable })).rejects.toBe(other);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("retries nothing when no predicate is given", async () => {
    const work = vi.fn().mockRejectedValue(conflict);
    await expect(withRetry(work)).rejects.toBe(conflict);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("attempts once when told to", async () => {
    const work = vi.fn().mockRejectedValue(conflict);
    await expect(withRetry(work, { attempts: 1, retryable })).rejects.toBe(conflict);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
