/**
 * Read-only demo mode.
 *
 * The public deployment has sign-up disabled and one seeded account, so anyone
 * arriving can see the product without being able to create one of their own.
 * That account has to be able to *do* something, though. A decision log you
 * cannot touch teaches you very little about how it feels to use.
 *
 * The line drawn here: **the demo may write drafts, and may not change the
 * decision log.** A draft is private to its author and holds no ADR number, so
 * the worst a visitor can do is leave unfinished text behind. Accepting,
 * rejecting or superseding a seeded decision would change what the *next*
 * visitor sees, which is not a demo, it is a shared document nobody owns.
 *
 * Enforced at the action layer rather than in the domain: this is a property of
 * one deployment, not of what a decision log is.
 */

/** The account the public demo signs in as. Unset everywhere but production. */
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();

export function isDemoAccount(email: string | null | undefined): boolean {
  if (!DEMO_EMAIL || !email) return false;
  return email.trim().toLowerCase() === DEMO_EMAIL;
}

/**
 * What the demo account is told when it tries to change the log. Phrased as a
 * deliberate boundary rather than a failure, and it names the thing that *is*
 * allowed, so the refusal doubles as a signpost.
 */
export const DEMO_REFUSAL =
  "This is a read-only demo. You can write and save drafts, but the decision log itself stays as it is.";

/** True when sign-up is closed: the public deployment, not local development. */
export function signUpDisabled(): boolean {
  return process.env.DISABLE_SIGNUP === "1";
}

/** True when GitHub linking is switched off for this deployment. */
export function githubDisabled(): boolean {
  return process.env.DISABLE_GITHUB === "1";
}
