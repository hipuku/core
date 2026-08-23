"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { PasswordField } from "@/components/PasswordField";
import styles from "./AuthForm.module.css";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "sign-up";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = isSignUp
      ? await signUp.email({ name, email, password })
      : await signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      setPending(false);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          {isSignUp ? "Create your account" : "Welcome back"}
        </h2>
        <p className={styles.subtitle}>
          {isSignUp
            ? "Start recording decisions in minutes."
            : "Sign in to your decision log."}
        </p>
      </div>

      {isSignUp && (
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
      )}

      <label className="field">
        <span>Email</span>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </label>

      <PasswordField
        value={password}
        onChange={setPassword}
        showMeter={isSignUp}
        minLength={isSignUp ? 10 : undefined}
        autoComplete={isSignUp ? "new-password" : "current-password"}
      />

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className="btn btn--primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "…" : isSignUp ? "Create account" : "Sign in"}
      </button>

      <p className={styles.alt}>
        {isSignUp ? (
          <>
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/sign-up">Create one</Link>
          </>
        )}
      </p>
    </form>
  );
}
