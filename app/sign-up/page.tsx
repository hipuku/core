import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function SignUpPage() {
  return (
    <AuthShell>
      <AuthForm mode="sign-up" />
    </AuthShell>
  );
}
