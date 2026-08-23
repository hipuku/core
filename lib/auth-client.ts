import { createAuthClient } from "better-auth/react";

/** Client-side auth. Same origin as the app, so it needs no explicit baseURL. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
