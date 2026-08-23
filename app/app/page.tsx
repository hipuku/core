import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import { createWorkspace } from "./actions";
import styles from "./app.module.css";

export default async function WorkspacesPage() {
  const user = await requireUser();
  const workspaces = await decisionService.listWorkspaces(user.id);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.crumbs}>core · decision log</p>
          <h1 className={styles.h1}>Workspaces</h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <p className={styles.crumbs}>{user.email}</p>
          <SignOutButton className={styles.linkBtn} />
        </div>
      </header>

      {workspaces.length === 0 ? (
        <p className={styles.empty}>No workspaces yet. Create one to start recording decisions.</p>
      ) : (
        <ul className={styles.list}>
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <Link href={`/app/${workspace.id}`} className={styles.row}>
                <span className={styles.rowTitle}>{workspace.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>New workspace</h2>
        <form action={createWorkspace} className={styles.form}>
          <label>
            <span>Name</span>
            <input name="name" required placeholder="Platform team" />
          </label>
          <div className={styles.actionRow}>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Create workspace
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
