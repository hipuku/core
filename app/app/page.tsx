import Link from "next/link";
import { NewWorkspaceModal } from "@/components/NewWorkspaceModal";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import styles from "./app.module.css";

export default async function WorkspacesPage() {
  const user = await requireUser();
  const workspaces = await decisionService.listWorkspaces(user.id);

  return (
    <div>
      <div className={styles.pageHead}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Workspaces</h1>
            <NewWorkspaceModal />
          </div>
          <p className={styles.sub}>
            Each workspace is a team with its own decision log.
          </p>
        </div>
      </div>

      {workspaces.length === 0 ? (
        <p className={styles.empty}>
          No workspaces yet. Use + to create one and start recording decisions.
        </p>
      ) : (
        <ul className={styles.list}>
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <Link href={`/app/${workspace.id}`} className={styles.card}>
                <span className={styles.cardTitle}>{workspace.name}</span>
                <span className={styles.crumbs}>Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
