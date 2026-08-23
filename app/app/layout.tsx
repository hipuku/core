import { TopBar } from "@/components/TopBar";
import { requireUser } from "@/lib/session";
import styles from "./shell.module.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className={styles.shell}>
      <TopBar user={{ name: user.name, email: user.email }} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
