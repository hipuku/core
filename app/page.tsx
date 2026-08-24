import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** No marketing landing: signed in goes to the app, signed out to sign-in. */
export default async function Home() {
  const session = await getSession();
  redirect(session ? "/app" : "/sign-in");
}
