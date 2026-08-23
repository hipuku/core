import { AuthForm } from "@/components/AuthForm";

export default function SignUpPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <AuthForm mode="sign-up" />
    </main>
  );
}
