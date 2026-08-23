"use client";

import Link from "next/link";

/**
 * Catches errors thrown by server actions in the app area — chiefly permission
 * refusals surfaced by the decision service. The UI already hides actions a user
 * cannot take; this is the backstop for anything that slips through.
 */
export default function AppError({ error }: { error: Error }) {
  return (
    <div style={{ maxWidth: "40rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
        That action could not be completed
      </h1>
      <p style={{ opacity: 0.75, marginBottom: "1.5rem" }}>{error.message}</p>
      <Link href="/app" style={{ textDecoration: "underline" }}>
        Back to workspaces
      </Link>
    </div>
  );
}
