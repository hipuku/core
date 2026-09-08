"use client";

import Link from "next/link";
import { Button } from "haus-components";

export default function AppError({ error }: { error: Error }) {
  return (
    <div style={{ maxWidth: "34rem", margin: "4rem auto", textAlign: "center" }}>
      <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>
        Action refused
      </p>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        That could not be completed
      </h1>
      <p style={{ color: "var(--text-dim)", marginBottom: "1.5rem" }}>
        {error.message}
      </p>
      <Button asChild variant="secondary">
        <Link href="/app">Back to workspaces</Link>
      </Button>
    </div>
  );
}
