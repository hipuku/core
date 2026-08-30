import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { haveIBeenPwned } from "better-auth/plugins";
import { db } from "@/lib/db";
import { githubDisabled } from "@/lib/demo";
import * as schema from "@/lib/db/schema";

/**
 * Server-side auth. Email + password to start, the simplest credential that proves
 * the multi-user story end to end without an OAuth provider to provision. Social
 * providers slot in here later without touching the rest of the app.
 */
// Only register GitHub when its credentials are present, so a build or a deploy
// without them still stands up email/password auth.
//
// `DISABLE_GITHUB` switches it off even when they are: the app requests the
// `repo` scope, which is read *and write* on private repositories, and on a
// public deployment that would mean holding a stranger's credentials with write
// access to their code. The feature stays in the codebase and in the docs; it
// is the storing of other people's tokens that is switched off.
const githubProvider =
  !githubDisabled() && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          // `repo` lets us read files from private repos the user collaborates
          // on. better-auth already requests read:user + user:email by default.
          scope: ["repo"],
        },
      }
    : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  socialProviders: githubProvider,
  account: {
    accountLinking: {
      // Let a signed-in email/password user connect their GitHub account, even
      // when the GitHub email differs from their core email. They are already
      // authenticated and GitHub verifies its emails, so self-linking is safe.
      enabled: true,
      trustedProviders: ["github"],
      allowDifferentEmails: true,
    },
  },
  plugins: [
    // Rejects passwords found in known breaches, checked via k-anonymity so the
    // password itself never leaves the server in the clear.
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "This password has appeared in a data breach. Please choose another.",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
