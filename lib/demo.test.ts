import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The demo rules are read from the environment at module load, so each case
 * sets the environment and re-imports rather than mutating a cached module.
 *
 * `vi.resetModules()` rather than a cache-busting query string: a query turns
 * `./demo.ts` into `./demo.ts?0.42` as far as the transform pipeline is
 * concerned, which no longer looks like TypeScript, and the file fails to parse
 * on its first type annotation.
 */
async function load(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
  return import("./demo");
}

const KEYS = ["DEMO_USER_EMAIL", "DISABLE_SIGNUP", "DISABLE_GITHUB"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("isDemoAccount", () => {
  it("is nobody when DEMO_USER_EMAIL is unset, the local default", async () => {
    const { isDemoAccount } = await load({ DEMO_USER_EMAIL: undefined });
    expect(isDemoAccount("demo@core.hipuku.dev")).toBe(false);
    expect(isDemoAccount("anyone@example.com")).toBe(false);
  });

  it("matches the configured account", async () => {
    const { isDemoAccount } = await load({ DEMO_USER_EMAIL: "demo@core.hipuku.dev" });
    expect(isDemoAccount("demo@core.hipuku.dev")).toBe(true);
  });

  it("matches regardless of case or surrounding space", async () => {
    const { isDemoAccount } = await load({ DEMO_USER_EMAIL: "  Demo@Core.Hipuku.Dev " });
    expect(isDemoAccount("demo@core.hipuku.dev")).toBe(true);
    expect(isDemoAccount("DEMO@CORE.HIPUKU.DEV")).toBe(true);
  });

  it("does not match anyone else", async () => {
    const { isDemoAccount } = await load({ DEMO_USER_EMAIL: "demo@core.hipuku.dev" });
    expect(isDemoAccount("author@core.hipuku.dev")).toBe(false);
    // A prefix must not pass: substring matching here would be a privilege bug.
    expect(isDemoAccount("demo@core.hipuku.dev.evil.com")).toBe(false);
  });

  it("handles a missing email without throwing", async () => {
    const { isDemoAccount } = await load({ DEMO_USER_EMAIL: "demo@core.hipuku.dev" });
    expect(isDemoAccount(null)).toBe(false);
    expect(isDemoAccount(undefined)).toBe(false);
    expect(isDemoAccount("")).toBe(false);
  });
});

describe("deployment flags", () => {
  it("are off unless explicitly set to 1", async () => {
    const off = await load({ DISABLE_SIGNUP: undefined, DISABLE_GITHUB: undefined });
    expect(off.signUpDisabled()).toBe(false);
    expect(off.githubDisabled()).toBe(false);

    // Anything other than "1" is not a switch. "true" or "yes" reading as on
    // would make a typo silently change what a deployment allows.
    const loose = await load({ DISABLE_SIGNUP: "true", DISABLE_GITHUB: "yes" });
    expect(loose.signUpDisabled()).toBe(false);
    expect(loose.githubDisabled()).toBe(false);
  });

  it("are on when set to 1", async () => {
    const on = await load({ DISABLE_SIGNUP: "1", DISABLE_GITHUB: "1" });
    expect(on.signUpDisabled()).toBe(true);
    expect(on.githubDisabled()).toBe(true);
  });
});
