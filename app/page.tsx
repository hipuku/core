import styles from "./page.module.css";

export default function Home() {
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
      </div>
    </main>
  );
}
