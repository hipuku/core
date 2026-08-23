import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/** Every better-auth endpoint (sign-in, sign-up, session, sign-out) hangs off here. */
export const { GET, POST } = toNextJsHandler(auth);
