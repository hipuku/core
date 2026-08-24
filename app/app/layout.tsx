import { TopBar } from "@/components/TopBar";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import styles from "./shell.module.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const workspaces = await decisionService.listWorkspaces(user.id);
  return (
    <div className={styles.shell}>
      <TopBar
        user={{ name: user.name, email: user.email }}
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
