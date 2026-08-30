import { describe, expect, it, vi } from "vitest";
import { attempt } from "./attempt";
import { DecisionError } from "@/lib/decisions";

/**
 * The mapping every mutating action funnels its failures through, and until now
 * the only untested part of that path. It sat inside the "use server" module,
 * where a test cannot reach it: that file may only export async functions, so a
 * helper defined there is private by construction.
 */
describe("attempt", () => {
  it("reports the success message when the work completes", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    await expect(attempt(run, "Saved.")).resolves.toEqual({ ok: "Saved." });
  });

  it("turns a refused guard into its own reason", async () => {
    const run = vi.fn().mockRejectedValue(new DecisionError("you do not have permission"));
    await expect(attempt(run, "Saved.")).resolves.toEqual({
      error: "you do not have permission",
    });
  });

  it("passes a GitHub failure through as words", async () => {
    // github.ts throws these with the status in the message, and they are
    // things a person can act on: an outage, a repo they cannot read.
    const run = vi.fn().mockRejectedValue(new Error("GitHub tree failed (503)"));
    await expect(attempt(run, "Saved.")).resolves.toEqual({
      error: "GitHub tree failed (503)",
    });
  });

  it("rethrows anything else", async () => {
    // A bug must not arrive as a toast. If it does, nobody finds out it exists.
    const boom = new TypeError("cannot read properties of undefined");
    const run = vi.fn().mockRejectedValue(boom);
    await expect(attempt(run, "Saved.")).rejects.toBe(boom);
  });

  it("rethrows a redirect rather than swallowing it", async () => {
    // Next signals a redirect by throwing. Catching it here would turn a
    // successful propose into an error toast on a page that never moves.
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/app/w1;307;",
    });
    const run = vi.fn().mockRejectedValue(redirect);
    await expect(attempt(run, "Saved.")).rejects.toBe(redirect);
  });

  it("does not treat a message merely containing 'GitHub' as a GitHub failure", async () => {
    // The check is on the prefix. A stray mention in the middle of a message
    // is not the shape github.ts produces.
    const other = new Error("could not reach GitHub-like service");
    const run = vi.fn().mockRejectedValue(other);
    await expect(attempt(run, "Saved.")).rejects.toBe(other);
  });
});
