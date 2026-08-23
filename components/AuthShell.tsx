import styles from "./AuthShell.module.css";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.split}>
      <div className={styles.brandPane}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden />
          core
        </div>

        <div className={styles.pitch}>
          <h1 className={styles.pitchTitle}>Decisions, on the record.</h1>
          <p className={styles.pitchBody}>
            A team decision log for architecture decision records. A
            permission-gated lifecycle, an immutable trail, and every change
            attributable — so the &ldquo;why&rdquo; behind a system never gets lost.
          </p>
          <ul className={styles.points}>
            <li className={styles.point}>
              <span className={styles.dot} /> Proposed → accepted → superseded, with approvals
            </li>
            <li className={styles.point}>
              <span className={styles.dot} /> Two audit trails: how the text changed, how the decision moved
            </li>
            <li className={styles.point}>
              <span className={styles.dot} /> Accepted decisions are immutable — you supersede, not rewrite
            </li>
          </ul>
        </div>

        <p className={styles.foot}>core · decision log</p>
      </div>

      <div className={styles.formPane}>
        <div className={styles.formInner}>{children}</div>
      </div>
    </div>
  );
}
