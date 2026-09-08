import { FileText, Users } from "lucide-react";
import Link from "next/link";
import { GithubMark } from "@/components/icons/GithubMark";
import { NewWorkspaceModal } from "@/components/NewWorkspaceModal";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import styles from "./app.module.css";
import { EmptyState, Card } from "haus-components";

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
        <EmptyState
          title="No workspaces yet"
          description="Create one to start recording decisions."
        />
      ) : (
        <ul className={styles.list}>
          {summaries.map(
            ({ workspace, decisionCount, proposedCount, memberCount, repos }) => (
              <li key={workspace.id}>
                <Link href={`/app/${workspace.id}`} className={styles.wsLink}>
                  <Card variant="elevated" padding={false} className={styles.wsCard}>
                    <span className={styles.wsName}>{workspace.name}</span>
                    <div className={styles.wsMeta}>
                      {proposedCount > 0 && (
                        <span className={styles.wsPending}>
                          {proposedCount} awaiting review
                        </span>
                      )}
                      <span className={styles.wsMetaItem} title={`${decisionCount} decisions`}>
                        <FileText size={14} aria-hidden />
                        {decisionCount}
                      </span>
                      <span className={styles.wsMetaItem} title={`${memberCount} members`}>
                        <Users size={14} aria-hidden />
                        {memberCount}
                      </span>
                      {repos.length > 0 ? (
                        <span
                          className={styles.wsMetaItem}
                          title={repos.join(", ")}
                        >
                          <GithubMark size={14} />
                          {repos.length}
                        </span>
                      ) : (
                        <span className={styles.wsMetaItem}>no repo connected</span>
                      )}
                    </div>
                  </Card>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
