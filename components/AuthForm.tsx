"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
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
      <h1 className={styles.title}>{isSignUp ? "Create an account" : "Sign in"}</h1>

      {isSignUp && (
        <label className={styles.field}>
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
      )}

      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={pending}>
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
