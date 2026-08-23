import Link from "next/link";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import { createWorkspace } from "./actions";
import styles from "./app.module.css";

export default async function WorkspacesPage() {
  const user = await requireUser();
  const workspaces = await decisionService.listWorkspaces(user.id);

  return (
    <div>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.crumbs}>workspaces</p>
          <h1 className={styles.title}>Your workspaces</h1>
          <p className={styles.sub}>
            Each workspace is a team with its own decision log.
          </p>
        </div>
      </div>

      {workspaces.length === 0 ? (
        <p className={styles.empty}>
          No workspaces yet. Create one below to start recording decisions.
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

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>New workspace</h2>
        </div>
        <form action={createWorkspace} className={styles.form}>
          <label className="field">
            <span>Name</span>
            <input className="input" name="name" required placeholder="Platform team" />
          </label>
          <div className={styles.actions}>
            <button type="submit" className="btn btn--primary">
              Create workspace
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
