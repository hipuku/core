import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { DemoCredentials } from "@/components/DemoCredentials";
import { signUpDisabled } from "@/lib/demo";
import { getSession } from "@/lib/session";

export default async function SignInPage() {
  if (await getSession()) redirect("/app");

  // Only where sign-up is closed: locally you make your own account, and
  // advertising a shared password there would be noise.
  const demo =
    signUpDisabled() && process.env.DEMO_USER_EMAIL && process.env.DEMO_USER_PASSWORD
      ? {
          email: process.env.DEMO_USER_EMAIL,
          password: process.env.DEMO_USER_PASSWORD,
        }
      : null;

  return (
    <AuthShell>
      <AuthForm mode="sign-in" hideSignUpLink={signUpDisabled()} />
      {demo && <DemoCredentials email={demo.email} password={demo.password} />}
    </AuthShell>
  );
}
