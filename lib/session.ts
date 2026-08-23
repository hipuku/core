import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** The current session, or null. Server-only. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** The current user, or a redirect to sign-in. Use to guard authenticated pages. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}
