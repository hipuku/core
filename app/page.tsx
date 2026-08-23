import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.kicker}>core</p>
        <h1 className={styles.title}>Scaffolding in place.</h1>
        <p className={styles.body}>
          A signed-in, multi-user product with an append-only version history —
          snapshot, diff, restore — as its engineering centrepiece. The
          versioning engine, database schema and auth are wired; the domain is
          next.
        </p>
        <ul className={styles.stack}>
          <li>Next.js</li>
          <li>Postgres · Drizzle</li>
          <li>better-auth</li>
          <li>versioning engine</li>
        </ul>
      </div>
    </main>
  );
}
