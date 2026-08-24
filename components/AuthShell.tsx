import { ChipPit } from "./ChipPit";
import styles from "./AuthShell.module.css";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.split}>
      <div className={styles.brandPane}>
        <span className={styles.brand}>core</span>
        <ChipPit />
      </div>

      <div className={styles.formPane}>
        <div className={styles.formInner}>{children}</div>
      </div>
    </div>
  );
}
