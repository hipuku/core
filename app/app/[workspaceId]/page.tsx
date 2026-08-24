import { Plus, Settings } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import styles from "../app.module.css";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  const role = await decisionService.roleOf(workspaceId, user.id);
  if (!role) notFound();

  const workspace = await decisionService.getWorkspace(workspaceId);
  if (!workspace) notFound();

  const decisions = await decisionService.listDecisions(workspaceId);
  const repos = await decisionService.listWorkspaceRepos(workspaceId);
  const article = role === "author" ? "an" : "a";

  return (
    <div>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Decisions</h1>
          <p className={styles.sub}>
            You are {article} {role} in this workspace.
          </p>
        </div>
        <div className={styles.headActions}>
          <Link href={`/app/${workspaceId}/new`} className="btn btn--primary">
            <Plus size={16} />
            New decision
          </Link>
          {role === "maintainer" && (
            <Link
              href={`/app/${workspaceId}/settings`}
              className="btn btn--icon"
              aria-label="Workspace settings"
              title="Workspace settings"
            >
              <Settings size={17} />
            </Link>
          )}
        </div>
      </div>

      {decisions.length === 0 ? (
        <p className={styles.empty}>
          No decisions yet. Propose the first one to start the log.
        </p>
      ) : (
        <ul className={styles.list}>
          {decisions.map((decision) => (
            <li key={decision.id}>
              <Link href={`/app/${workspaceId}/${decision.id}`} className={styles.card}>
                <span className={styles.cardNum}>
                  ADR-{String(decision.number).padStart(3, "0")}
                </span>
                <span className={styles.cardTitle}>{decision.title}</span>
                <StatusBadge status={decision.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {repos.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Connected repositories</h2>
          </div>
          <div className={styles.repoChips}>
            {repos.map((repo) => (
              <span key={repo.id} className={styles.wsRepo}>
                {repo.owner}/{repo.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
