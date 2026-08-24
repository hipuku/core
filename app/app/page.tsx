import Link from "next/link";
import type { CSSProperties } from "react";
import { NewWorkspaceModal } from "@/components/NewWorkspaceModal";
import { brandColor } from "@/lib/brand";
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
          <h1 className={styles.title}>Workspaces</h1>
          <p className={styles.sub}>
            Each workspace is a team with its own decision log.
          </p>
        </div>
        <NewWorkspaceModal />
      </div>

      {summaries.length === 0 ? (
        <p className={styles.empty}>
          No workspaces yet. Create one to start recording decisions.
        </p>
      ) : (
        <ul className={styles.list}>
          {summaries.map(
            ({ workspace, decisionCount, proposedCount, memberCount, repos }) => (
              <li key={workspace.id}>
                <Link href={`/app/${workspace.id}`} className={styles.wsCard}>
                  <span className={styles.wsName}>{workspace.name}</span>
                  <div className={styles.wsMeta}>
                    <span className={styles.wsMetaItem}>
                      {plural(decisionCount, "decision")}
                    </span>
                    {proposedCount > 0 && (
                      <span className={styles.wsPending}>
                        {proposedCount} awaiting review
                      </span>
                    )}
                    <span className={styles.wsMetaItem}>
                      {plural(memberCount, "member")}
                    </span>
                    {repos.length > 0 ? (
                      repos.map((repo, i) => (
                        <span
                          key={repo}
                          className={styles.wsRepo}
                          style={{ "--chip": brandColor(i) } as CSSProperties}
                        >
                          {repo}
                        </span>
                      ))
                    ) : (
                      <span className={styles.wsMetaItem}>no repo connected</span>
                    )}
                  </div>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
