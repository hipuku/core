import { Archive, Check, Pencil, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionMeta } from "@/components/DecisionMeta";
import { DecisionReferences } from "@/components/DecisionReferences";
import { Lineage } from "@/components/Lineage";
import { Markdown } from "@/components/Markdown";
import { StatusBadge } from "@/components/StatusBadge";
import { SupersedeModal } from "@/components/SupersedeModal";
import { ToastForm } from "@/components/ToastForm";
import {
  canEditContent,
  capabilitiesFor,
  decisionLabel,
  decisionService,
  formatRange,
  isStale,
  supersessionChain,
} from "@/lib/decisions";
import type { Change, Json } from "@/lib/versioning";
import { requireUser } from "@/lib/session";
import { timeAgo } from "@/lib/time-ago";
import { usersById } from "@/lib/users";
import { changeStatus, checkReferenceDrift, supersede } from "../../actions";
import styles from "../../app.module.css";
import { SubmitButton } from "@/components/SubmitButton";
import { SubmitIconButton } from "@/components/SubmitIconButton";
import { Button } from "haus-components";

function field(body: Json, key: string): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const value = body[key];
    return typeof value === "string" ? value : "";
  }
  return "";
}

function describe(change: Change): string {
  const value = change.op === "remove" ? change.before : change.after;
  const at = change.path.replace(/^\//, "").replace(/\//g, " › ") || "(root)";
  return `${change.op} ${at}${value === undefined ? "" : ` = ${JSON.stringify(value)}`}`;
}

function when(date: Date): string {
  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** A decision is a date-level fact; the minute it was filed is noise. */
function onlyDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ workspaceId: string; decisionId: string }>;
}) {
  const { workspaceId, decisionId } = await params;
  const user = await requireUser();

  const role = await decisionService.roleOf(workspaceId, user.id);
  if (!role) notFound();

  const found = await decisionService.getDecision(decisionId);
  if (!found || found.workspaceId !== workspaceId) notFound();
  const decision = found;

  const actor = { id: user.id, capabilities: capabilitiesFor(role) };
  const [content, transitions, all, references, repos, workspace] =
    await Promise.all([
      decisionService.contentHistory(decisionId),
      decisionService.statusHistory(decisionId),
      decisionService.listDecisions(workspaceId),
      decisionService.listReferences(decisionId),
      decisionService.listWorkspaceRepos(workspaceId),
      decisionService.getWorkspace(workspaceId),
    ]);
  const key = workspace?.key ?? "ADR";
  // What inline `{{repo:path}}` citations in the body can resolve against.
  const citable = repos.map((r) => ({
    repo: `${r.owner}/${r.name}`,
    branch: r.defaultBranch,
  }));

  const people = await usersById([
    decision.authorId,
    ...transitions.map((t) => t.actorId),
  ]);
  const nameOf = (id: string) => people.get(id)?.name ?? "someone";

  const body = content.at(-1)?.state ?? {};
  // The first version is the proposal itself, so "last edited" only exists once
  // there has been a revision. Otherwise created and edited would always match.
  const lastEdited = content.length > 1 ? content.at(-1)!.createdAt : null;
  const editable = canEditContent(
    decision.status,
    actor,
    decision.authorId === user.id,
  );

  const canAccept = actor.capabilities.includes("accept") && decision.status === "proposed";
  const canReject = actor.capabilities.includes("reject") && decision.status === "proposed";
  const canDeprecate = actor.capabilities.includes("deprecate") && decision.status === "accepted";
  const canSupersede = actor.capabilities.includes("supersede") && decision.status === "accepted";
  const supersedable = all.filter((d) => d.id !== decision.id && d.status === "accepted");
  const lastOf = (status: string) => [...transitions].reverse().find((t) => t.toStatus === status);

  const stale = isStale(references);
  const hasFileRefs = references.some((r) => r.kind === "file");
  /** The most recent drift check across every file reference. */
  /**
   * The most recent thing that happened to this decision, of either kind: a
   * status change or a revision. Both timelines are already loaded.
   */
  const lastActivity = [
    ...transitions.map((t) => t.createdAt),
    ...content.map((v) => v.createdAt),
  ].reduce<number | null>((latest, date) => {
    const at = new Date(date).getTime();
    return latest === null || at > latest ? at : latest;
  }, null);

  /** The transition that put this decision in its current state. */
  const settled = decision.status === "proposed" ? null : lastOf(decision.status);
  // The whole chain this decision sits in, not just the next hop.
  const lineage = supersessionChain(all, decision.id);
  const lastChecked = references.reduce<Date | null>((latest, r) => {
    if (!r.checkedAt) return latest;
    return !latest || r.checkedAt > latest ? r.checkedAt : latest;
  }, null);

  const base = `/app/${workspaceId}/${decisionId}`;
  const adrNumber = decisionLabel(key, decision.number);

  const accept = changeStatus.bind(null, workspaceId, decisionId, "accepted");
  const reject = changeStatus.bind(null, workspaceId, decisionId, "rejected");
  const deprecate = changeStatus.bind(null, workspaceId, decisionId, "deprecated");

  return (
    <div className={styles.decisionPage}>
      <div className={styles.pageHead}>
        <div className={styles.headMain}>
          <p className={styles.headKey}>
            <span className="key-chip">{adrNumber}</span>
          </p>
          <h1 className={styles.title}>{decision.title}</h1>
        </div>
        {/* The page-level action belongs in the page header, once, rather than floating
            above the prose and repeated inside the review banner. */}
        {/* Every action this decision affords, in one place, weighted so the
            consequential one is unmistakable: Edit is quiet, Reject is text,
            and Approve, an irreversible and audited transition, is the only
            filled control on the page. */}
        <div className={styles.headActions}>
          {editable.ok && (
            <Button asChild variant="secondary">
              <Link href={`${base}/edit`}>
                <Pencil size={15} />
                Edit
              </Link>
            </Button>
          )}
          {canReject && (
            <ToastForm action={reject}>
              <SubmitButton variant="secondary" tone="error">
                <X size={16} />
                Reject
              </SubmitButton>
            </ToastForm>
          )}
          {canAccept && (
            <ToastForm action={accept}>
              <SubmitButton variant="primary" tone="success">
                <Check size={16} />
                Approve
              </SubmitButton>
            </ToastForm>
          )}
          {canSupersede && (
            <SupersedeModal
              action={supersede.bind(null, workspaceId, decisionId)}
              candidates={supersedable.map((d) => ({
                id: d.id,
                label: decisionLabel(key, d.number),
                title: d.title,
              }))}
            />
          )}
          {canDeprecate && (
            <ToastForm action={deprecate}>
              <SubmitButton variant="secondary">
                <Archive size={16} />
                Deprecate
              </SubmitButton>
            </ToastForm>
          )}
        </div>
      </div>

      {/* properties */}
      <DecisionMeta
        count={transitions.length + content.length}
        lastActivity={lastActivity}
        activity={
            <div className={styles.activity}>
              <section className={styles.activityGroup}>
                <h2>Status history</h2>
                <div className={styles.timeline}>
                  {transitions.map((t) => (
                    <div key={t.id} className={styles.tlItem}>
                      <div className={styles.tlHead}>
                        <StatusBadge status={t.toStatus} />
                        <span className={styles.tlMsg}>
                          {t.fromStatus ? `from ${t.fromStatus}` : "proposed"} by {nameOf(t.actorId)}
                        </span>
                      </div>
                      <div className={styles.tlMeta}>{when(t.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.activityGroup}>
                <h2>Content history</h2>
                <div className={styles.timeline}>
                  {content.map((version) => (
                    <div key={version.id} className={styles.tlItem}>
                      <div className={styles.tlHead}>
                        <span className={styles.tlMsg}>{version.message}</span>
                      </div>
                      <div className={styles.tlMeta}>{when(version.createdAt)}</div>
                      {version.changes.length > 0 && (
                        <ul className={styles.changes}>
                          {version.changes.map((change, i) => (
                            <li
                              key={i}
                              className={
                                change.op === "add"
                                  ? styles.opAdd
                                  : change.op === "remove"
                                    ? styles.opRemove
                                    : styles.opReplace
                              }
                            >
                              {describe(change)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
        }
      >
        <div className={styles.prop}>
          <span className={styles.propLabel}>Status</span>
          <span className={styles.propValue}><StatusBadge status={decision.status} /></span>
        </div>
        <div className={styles.prop}>
          <span className={styles.propLabel}>Owner</span>
          <span className={styles.propValue}>{nameOf(decision.authorId)}</span>
        </div>
        <div className={styles.prop}>
          <span className={styles.propLabel}>Created</span>
          <span className={styles.propValue}>{onlyDate(decision.createdAt)}</span>
        </div>
        <div className={styles.prop}>
          <span className={styles.propLabel}>Last edited</span>
          <span className={styles.propValue}>
            {lastEdited ? (
              <>
                {onlyDate(lastEdited)}
                <span className={styles.propAside}>{timeAgo(lastEdited.getTime())}</span>
              </>
            ) : (
              <span className={styles.propAside}>never revised</span>
            )}
          </span>
        </div>

        {/* What the pill cannot carry: who moved this decision to where it is,
            and what replaced it. A property rather than a banner: it is a fact about
            the record, and it belongs with the record's other facts. */}
        {settled && (
          <div className={styles.prop}>
            <span className={styles.propLabel}>
              {decision.status === "accepted" ? "Accepted" : decision.status}
            </span>
            <span className={styles.propValue}>
              {nameOf(settled.actorId)}
              <span className={styles.propAside}>{onlyDate(settled.createdAt)}</span>
            </span>
          </div>
        )}

      </DecisionMeta>

      <Lineage workspaceId={workspaceId} workspaceKey={key} chain={lineage} />

      {stale && (
        <div className={`${styles.notice} ${styles.noticeWarn}`}>
          <div className={styles.noticeText}>
            <span className={styles.noticeTitle}>Referenced code has changed</span>
            <span className={styles.noticeSub}>
              Code this decision cites has drifted since it was recorded, so it may
              be out of date. See References below.
            </span>
          </div>
        </div>
      )}

      <div className={styles.sheet}>
          <article className={styles.doc}>
            {(["context", "decision", "consequences"] as const).map((block) => {
              const text = field(body, block);
              return (
                <section
                  key={block}
                  className={`${styles.docBlock} ${
                    block === "decision" ? styles.docBlockLead : ""
                  }`}
                >
                  <h2 className={styles.docLabel}>{block}</h2>
                  {text ? (
                    <Markdown citable={citable}>{text}</Markdown>
                  ) : (
                    <p className={styles.docEmpty}>Not yet written.</p>
                  )}
                </section>
              );
            })}
          </article>

          {/* On the same paper, below a rule: references belong to this
              document, so giving them a card of their own added a surface
              without adding a distinction. */}
          <section className={styles.docFooter}>
            <div className={styles.docFooterHead}>
              <h2 className={styles.docFooterTitle}>References</h2>
              {hasFileRefs && (
                <ToastForm action={checkReferenceDrift.bind(null, workspaceId, decisionId)}>
                  <span className={styles.syncRow}>
                    <span className={styles.syncWhen}>
                      {lastChecked
                        ? `checked ${timeAgo(lastChecked.getTime())}`
                        : "never checked"}
                    </span>
                    <SubmitIconButton
                      icon={<RefreshCw size={14} />}
                      label="Check for drift"
                      title="Check whether the cited code has changed"
                      variant="ghost"
                    />
                  </span>
                </ToastForm>
              )}
            </div>
            <DecisionReferences
              references={references.map((r) => ({
                id: r.id,
                kind: r.kind,
                label: r.label,
                url: r.url,
                repo: r.repo,
                path: r.path,
                lines:
                  r.startLine && r.endLine
                    ? formatRange({ start: r.startLine, end: r.endLine })
                    : null,
                startLine: r.startLine,
                baselineSha: r.baselineSha,
                currentSha: r.currentSha,
              }))}
            />
          </section>
        </div>
    </div>
  );

}
