import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import styles from "@/app/app/shell.module.css";

export function TopBar({ user }: { user: { name: string; email: string } }) {
  return (
    <header className={styles.topbar}>
      <Link href="/app" className={styles.brand}>
        <span className={styles.mark} aria-hidden />
        core
      </Link>
      <UserMenu user={user} />
    </header>
  );
}
