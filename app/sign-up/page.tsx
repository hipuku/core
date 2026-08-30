import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { signUpDisabled } from "@/lib/demo";
import { getSession } from "@/lib/session";

export default async function SignUpPage() {
  if (await getSession()) redirect("/app");
  // The public deployment has no sign-up at all: one seeded read-only account,
  // and nothing for anyone to create. A gate you can pass with a shared code is
  // not access control, since whoever has the code can pass it on, so the page
  // simply does not exist rather than pretending to guard something.
  if (signUpDisabled()) notFound();

  return (
    <AuthShell>
      <AuthForm mode="sign-up" />
    </AuthShell>
  );
}
