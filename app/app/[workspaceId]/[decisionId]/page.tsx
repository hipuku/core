import {
  Archive,
  ArrowLeftRight,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileReferencePicker } from "@/components/FileReferencePicker";
import { Markdown } from "@/components/Markdown";
import { StatusBadge } from "@/components/StatusBadge";
import { ToastForm } from "@/components/ToastForm";
import {
  canEditContent,
  capabilitiesFor,
  decisionLabel,
  decisionService,
  isStale,
  referenceDrift,
  type DriftStatus,
} from "@/lib/decisions";
import type { Change, Json } from "@/lib/versioning";
import { requireUser } from "@/lib/session";
import { usersById } from "@/lib/users";
import {
  addReference,
  changeStatus,
  checkReferenceDrift,
  removeReference,
  revise,
  supersede,
} from "../../actions";
import styles from "../../app.module.css";

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

const DRIFT_PILL: Record<DriftStatus, { cls: string; label: string } | null> = {
  synced: { cls: "pill pill--accepted", label: "in sync" },
  drifted: { cls: "pill pill--superseded", label: "changed" },
  missing: { cls: "pill pill--rejected", label: "missing" },
  unknown: null,
};

export default async function DecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; decisionId: string }>;
  searchParams: Promise<{ view?: string; edit?: string }>;
}) {
  const { workspaceId, decisionId } = await params;
  const { view, edit } = await searchParams;
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

  const people = await usersById([
    decision.authorId,
    ...transitions.map((t) => t.actorId),
  ]);
  const nameOf = (id: string) => people.get(id)?.name ?? "someone";

  const body = content.at(-1)?.state ?? {};
  const editable = canEditContent(
    decision.status,
    actor,
    decision.authorId === user.id,
  );
  const isEditing = editable.ok && edit === "1";

  const canAccept = actor.capabilities.includes("accept") && decision.status === "proposed";
  const canReject = actor.capabilities.includes("reject") && decision.status === "proposed";
  const canDeprecate = actor.capabilities.includes("deprecate") && decision.status === "accepted";
  const canSupersede = actor.capabilities.includes("supersede") && decision.status === "accepted";
  const supersedable = all.filter((d) => d.id !== decision.id && d.status === "accepted");
  const supersededBy = decision.supersededById
    ? all.find((d) => d.id === decision.supersededById)
    : null;
  const lastOf = (status: string) => [...transitions].reverse().find((t) => t.toStatus === status);

  const stale = isStale(references);
  const hasFileRefs = references.some((r) => r.kind === "file");

  const base = `/app/${workspaceId}/${decisionId}`;
  const tab = view === "activity" ? "activity" : "document";
  const adrNumber = decisionLabel(key, decision.number);

  const accept = changeStatus.bind(null, workspaceId, decisionId, "accepted");
  const reject = changeStatus.bind(null, workspaceId, decisionId, "rejected");
  const deprecate = changeStatus.bind(null, workspaceId, decisionId, "deprecated");

  return (
    <div>
      <div className={styles.pageHead}>
        <div style={{ flex: 1 }}>
          <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            {adrNumber}
          </p>
          <h1 className={styles.title}>{decision.title}</h1>
        </div>
      </div>

      {/* properties */}
      <div className={styles.props}>
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
          <span className={styles.propValue}>{when(decision.createdAt)}</span>
        </div>
        {supersededBy && (
          <div className={styles.prop}>
            <span className={styles.propLabel}>Superseded by</span>
            <span className={styles.propValue}>
              <Link href={`/app/${workspaceId}/${supersededBy.id}`}>
                {decisionLabel(key, supersededBy.number)}
              </Link>
            </span>
          </div>
        )}
      </div>

      {/* review banner */}
      <ReviewBanner />

      {stale && (
        <div className={styles.staleBanner}>
          <span className={styles.staleDot} />
          <div>
            <strong>Referenced code has changed.</strong> One or more files this
            decision cites have drifted since it was recorded — it may be out of
            date. See References for detail.
          </div>
        </div>
      )}

      {/* tabs */}
      <div className={styles.tabs}>
        <Link href={base} className={`${styles.tab} ${tab === "document" ? styles.tabOn : ""}`}>
          Document
        </Link>
        <Link href={`${base}?view=activity`} className={`${styles.tab} ${tab === "activity" ? styles.tabOn : ""}`}>
          Activity<span className={styles.tabCount}>{transitions.length + content.length}</span>
        </Link>
      </div>

      {tab === "document" ? (
        isEditing ? (
          <ToastForm action={revise.bind(null, workspaceId, decisionId)} className={styles.form}>
            <p className={styles.hint}>
              Markdown supported, including <code>```mermaid</code> diagrams.
            </p>
            <label className="field">
              <span>Context</span>
              <textarea className="textarea" name="context" rows={3} defaultValue={field(body, "context")} />
            </label>
            <label className="field">
              <span>Decision</span>
              <textarea className="textarea" name="decision" rows={3} defaultValue={field(body, "decision")} />
            </label>
            <label className="field">
              <span>Consequences</span>
              <textarea className="textarea" name="consequences" rows={3} defaultValue={field(body, "consequences")} />
            </label>
            <div className={styles.actions}>
              <button type="submit" className="btn btn--primary">
                <Check size={16} />
                Save revision
              </button>
              <Link href={base} className="btn btn--ghost">Cancel</Link>
            </div>
          </ToastForm>
        ) : (
          <div className={styles.doc}>
            {editable.ok && (
              <div className={styles.actions}>
                <Link href={`${base}?edit=1`} className="btn"><Pencil size={15} />Edit</Link>
              </div>
            )}
            {(["context", "decision", "consequences"] as const).map((key) => {
              const text = field(body, key);
              return (
                <div key={key} className={styles.docBlock}>
                  <h3>{key}</h3>
                  {text ? (
                    <Markdown>{text}</Markdown>
                  ) : (
                    <p className={styles.docEmpty}>Not yet written.</p>
                  )}
                </div>
              );
            })}

            <div className={styles.docBlock}>
              <h3>References</h3>
              {references.length === 0 ? (
                <p className={styles.docEmpty}>No references attached.</p>
              ) : (
                <ul className={styles.refList}>
                  {references.map((ref) => {
                    const pill = DRIFT_PILL[referenceDrift(ref)];
                    return (
                      <li key={ref.id} className={styles.refItem}>
                        <a
                          href={ref.url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.refLink}
                        >
                          {ref.label || ref.url}
                        </a>
                        {pill && <span className={pill.cls}>{pill.label}</span>}
                        <ToastForm action={removeReference.bind(null, workspaceId, decisionId, ref.id)}>
                          <button type="submit" className={styles.refRemove} aria-label="Remove reference">
                            ×
                          </button>
                        </ToastForm>
                      </li>
                    );
                  })}
                </ul>
              )}

              {hasFileRefs && (
                <ToastForm
                  action={checkReferenceDrift.bind(null, workspaceId, decisionId)}
                  style={{ marginBottom: "0.85rem" }}
                >
                  <button type="submit" className="btn">
                    <RefreshCw size={15} />
                    Check for drift
                  </button>
                </ToastForm>
              )}
              <ToastForm
                action={addReference.bind(null, workspaceId, decisionId)}
                className={styles.refForm}
              >
                <input className="input" type="url" name="url" placeholder="https://…" required />
                <input className="input" name="label" placeholder="Label (optional)" />
                <button type="submit" className="btn">
                  <Plus size={16} />
                  Add link
                </button>
              </ToastForm>

              <FileReferencePicker
                workspaceId={workspaceId}
                decisionId={decisionId}
                repos={repos}
              />
            </div>
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          <section>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Decision history</h2>
            </div>
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

          <section>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Content history</h2>
            </div>
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
      )}
    </div>
  );

  function ReviewBanner() {
    if (decision.status === "proposed") {
      if (canAccept || canReject) {
        return (
          <div className={`${styles.review} ${styles.reviewAction}`}>
            <div className={styles.reviewText}>
              <span className={styles.reviewTitle}>Ready for your review</span>
              <span className={styles.reviewSub}>
                Approve to accept this decision, or reject it.
              </span>
            </div>
            <div className={styles.reviewActions}>
              {editable.ok && !isEditing && (
                <Link href={`${base}?edit=1`} className="btn btn--ghost"><Pencil size={15} />Edit</Link>
              )}
              {canReject && (
                <ToastForm action={reject}>
                  <button type="submit" className="btn btn--danger">
                    <X size={16} />
                    Reject
                  </button>
                </ToastForm>
              )}
              {canAccept && (
                <ToastForm action={accept}>
                  <button type="submit" className="btn btn--accept">
                    <Check size={16} />
                    Approve
                  </button>
                </ToastForm>
              )}
            </div>
          </div>
        );
      }
      return (
        <div className={styles.review}>
          <div className={styles.reviewText}>
            <span className={styles.reviewTitle}>Awaiting review</span>
            <span className={styles.reviewSub}>
              A maintainer needs to accept this decision.
              {editable.ok && " You can keep revising it until then."}
            </span>
          </div>
          {editable.ok && !isEditing && (
            <div className={styles.reviewActions}>
              <Link href={`${base}?edit=1`} className="btn"><Pencil size={15} />Edit</Link>
            </div>
          )}
        </div>
      );
    }

    if (decision.status === "accepted") {
      const accepted = lastOf("accepted");
      return (
        <div className={`${styles.review} ${styles.reviewOk}`}>
          <div className={styles.reviewText}>
            <span className={styles.reviewTitle}>Accepted</span>
            <span className={styles.reviewSub}>
              {accepted
                ? `by ${nameOf(accepted.actorId)} · ${when(accepted.createdAt)}`
                : "This decision is in effect."}
            </span>
          </div>
          {(canDeprecate || (canSupersede && supersedable.length > 0)) && (
            <div className={styles.reviewActions}>
              {canDeprecate && (
                <ToastForm action={deprecate}>
                  <button type="submit" className="btn btn--ghost">
                    <Archive size={16} />
                    Deprecate
                  </button>
                </ToastForm>
              )}
              {canSupersede && supersedable.length > 0 && (
                <form action={supersede.bind(null, workspaceId, decisionId)} style={{ display: "flex", gap: "0.4rem" }}>
                  <select className="select" name="supersededId" required defaultValue="" style={{ width: "auto" }}>
                    <option value="" disabled>Supersede…</option>
                    {supersedable.map((d) => (
                      <option key={d.id} value={d.id}>
                        {decisionLabel(key, d.number)} — {d.title}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn">
                    <ArrowLeftRight size={15} />
                    Supersede
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      );
    }

    // rejected / deprecated / superseded — terminal
    const term = lastOf(decision.status);
    return (
      <div className={`${styles.review} ${styles.reviewTerminal}`}>
        <div className={styles.reviewText}>
          <span className={styles.reviewTitle} style={{ textTransform: "capitalize" }}>
            {decision.status}
          </span>
          <span className={styles.reviewSub}>
            {supersededBy ? (
              <>
                Replaced by{" "}
                <Link href={`/app/${workspaceId}/${supersededBy.id}`} className={styles.reviewLink}>
                  {decisionLabel(key, supersededBy.number)} — {supersededBy.title}
                </Link>
              </>
            ) : term ? (
              `by ${nameOf(term.actorId)} · ${when(term.createdAt)}`
            ) : (
              "This decision is no longer active."
            )}
          </span>
        </div>
      </div>
    );
  }
}
