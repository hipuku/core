import Link from "next/link";
import { NewWorkspaceModal } from "@/components/NewWorkspaceModal";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import styles from "./app.module.css";

function plural(n: number, one: string) {
  return `${n} ${one}${n === 1 ? "" : "s"}`;
}

export default async function WorkspacesPage() {
  const user = await requireUser();
  const summaries = await decisionService.workspaceSummaries(user.id);

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

      {summaries.length === 0 ? (
        <p className={styles.empty}>
          No workspaces yet. Use + to create one and start recording decisions.
        </p>
      ) : (
        <ul className={styles.list}>
          {summaries.map(({ workspace, decisionCount, memberCount, repos }) => (
            <li key={workspace.id}>
              <Link href={`/app/${workspace.id}`} className={styles.wsCard}>
                <div className={styles.wsName}>{workspace.name}</div>
                <div className={styles.wsMeta}>
                  <span className={styles.wsMetaItem}>
                    {plural(decisionCount, "decision")}
                  </span>
                  <span className={styles.wsMetaItem}>
                    {plural(memberCount, "member")}
                  </span>
                  {repos.length > 0 ? (
                    repos.map((repo) => (
                      <span key={repo} className={styles.wsRepo}>
                        {repo}
                      </span>
                    ))
                  ) : (
                    <span className={styles.wsMetaItem}>no repo connected</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
