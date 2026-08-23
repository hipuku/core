import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { haveIBeenPwned } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * Server-side auth. Email + password to start — the simplest credential that proves
 * the multi-user story end to end without an OAuth provider to provision. Social
 * providers slot in here later without touching the rest of the app.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
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
