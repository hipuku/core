import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function SignInPage() {
  return (
    <AuthShell>
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}
