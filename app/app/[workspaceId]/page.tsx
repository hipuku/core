import { Plus, Settings } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { DraftList } from "@/components/DraftList";
import { StatusBadge } from "@/components/StatusBadge";
import { repoChipColor } from "@/lib/brand";
import { decisionLabel, decisionService } from "@/lib/decisions";
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

  // Newest first: a decision log is read from the current state backwards, and
  // the number already carries the chronology, so no separate sort is needed.
  const decisions = (await decisionService.listDecisions(workspaceId))
    .slice()
    .reverse();
  const repos = await decisionService.listWorkspaceRepos(workspaceId);
  const drafts = await decisionService.listDrafts(workspaceId, user.id);
  const article = role === "author" ? "an" : "a";

  return (
    <div>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>
            {workspace.name}{" "}
            <span className={styles.titleMuted}>Decisions</span>
          </h1>
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

      {/* Drafts head the list: same card, told apart by their tag. */}
      <DraftList
        workspaceId={workspaceId}
        workspaceKey={workspace.key}
        drafts={drafts.map((d) => ({
          id: d.id,
          title: d.title,
          body: d.body,
          // Dates do not survive the server/client boundary as Dates.
          updatedAt: d.updatedAt.toISOString(),
        }))}
      />

      {decisions.length === 0 && drafts.length === 0 ? (
        <p className={styles.empty}>
          No decisions yet. Propose the first one to start the log.
        </p>
      ) : decisions.length === 0 ? (
        <p className={styles.empty}>
          Nothing proposed yet — your draft above is not visible to anyone else
          until you propose it.
        </p>
      ) : (
        <ul className={styles.list}>
          {decisions.map((decision) => (
            <li key={decision.id}>
              <Link href={`/app/${workspaceId}/${decision.id}`} className={styles.card}>
                <span className={styles.cardNum}>
                  <span className="key-chip">
                    {decisionLabel(workspace.key, decision.number)}
                  </span>
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
            {repos.map((repo, i) => (
              <span
                key={repo.id}
                className={styles.wsRepo}
                style={{ "--chip": repoChipColor(i) } as CSSProperties}
              >
                {repo.owner}/{repo.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
