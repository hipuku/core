import { createAuthClient } from "better-auth/react";

/** Client-side auth. Same origin as the app, so it needs no explicit baseURL. */
export const authClient = createAuthClient();

// signIn/signUp are objects (signIn.email(...)) so destructuring keeps them usable.
// signOut is a bare method and must be called as authClient.signOut() to keep its
// binding, deliberately not re-exported here.
export const { signIn, signUp, useSession } = authClient;
