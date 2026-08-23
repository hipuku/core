import Link from "next/link";
import { getSession } from "@/lib/session";
import styles from "./page.module.css";

export default async function Home() {
  const session = await getSession();

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.kicker}>core · decision log</p>
        <h1 className={styles.title}>Decisions, on the record.</h1>
        <p className={styles.body}>
          A team decision log for architecture decision records. Every ADR moves
          through a permission-gated lifecycle — proposed, accepted, superseded —
          and carries two audit trails: how its text changed, and how the
          decision moved. Accepted decisions are immutable; you supersede them,
          you don&apos;t rewrite them.
        </p>
        <ul className={styles.stack}>
          <li>lifecycle state machine</li>
          <li>supersession graph</li>
          <li>version history</li>
          <li>Postgres · Drizzle · auth</li>
        </ul>
        <div className={styles.cta}>
          {session ? (
            <Link href="/app" className="btn btn--primary">
              Open your workspaces
            </Link>
          ) : (
            <>
              <Link href="/sign-up" className="btn btn--primary">
                Create an account
              </Link>
              <Link href="/sign-in" className="btn">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
