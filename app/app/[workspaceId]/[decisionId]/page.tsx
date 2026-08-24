import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { StatusBadge } from "@/components/StatusBadge";
import {
  canEditContent,
  capabilitiesFor,
  decisionService,
} from "@/lib/decisions";
import type { Change, Json } from "@/lib/versioning";
import { requireUser } from "@/lib/session";
import { usersById } from "@/lib/users";
import {
  addReference,
  changeStatus,
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
  const [content, transitions, all, references] = await Promise.all([
    decisionService.contentHistory(decisionId),
    decisionService.statusHistory(decisionId),
    decisionService.listDecisions(workspaceId),
    decisionService.listReferences(decisionId),
  ]);

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

  const base = `/app/${workspaceId}/${decisionId}`;
  const tab = view === "activity" ? "activity" : "document";
  const adrNumber = `ADR-${String(decision.number).padStart(3, "0")}`;

  const accept = changeStatus.bind(null, workspaceId, decisionId, "accepted");
  const reject = changeStatus.bind(null, workspaceId, decisionId, "rejected");
  const deprecate = changeStatus.bind(null, workspaceId, decisionId, "deprecated");

  return (
    <div>
      <div className={styles.pageHead}>
        <div style={{ flex: 1 }}>
          <p className={styles.crumbs}>
            <Link href="/app">workspaces</Link>
            <span className={styles.sep}>/</span>
            <Link href={`/app/${workspaceId}`}>decisions</Link>
            <span className={styles.sep}>/</span>
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
                ADR-{String(supersededBy.number).padStart(3, "0")}
              </Link>
            </span>
          </div>
        )}
      </div>

      {/* review banner */}
      <ReviewBanner />

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
          <form action={revise.bind(null, workspaceId, decisionId)} className={styles.form}>
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
              <button type="submit" className="btn btn--primary">Save revision</button>
              <Link href={base} className="btn btn--ghost">Cancel</Link>
            </div>
          </form>
        ) : (
          <div className={styles.doc}>
            {editable.ok && (
              <div className={styles.actions}>
                <Link href={`${base}?edit=1`} className="btn">Edit</Link>
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
                  {references.map((ref) => (
                    <li key={ref.id} className={styles.refItem}>
                      <a
                        href={ref.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.refLink}
                      >
                        {ref.label || ref.url}
                      </a>
                      <form action={removeReference.bind(null, workspaceId, decisionId, ref.id)}>
                        <button type="submit" className={styles.refRemove} aria-label="Remove reference">
                          ×
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form
                action={addReference.bind(null, workspaceId, decisionId)}
                className={styles.refForm}
              >
                <input className="input" type="url" name="url" placeholder="https://…" required />
                <input className="input" name="label" placeholder="Label (optional)" />
                <button type="submit" className="btn">Add link</button>
              </form>
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
                <Link href={`${base}?edit=1`} className="btn btn--ghost">Edit</Link>
              )}
              {canReject && (
                <form action={reject}>
                  <button type="submit" className="btn btn--danger">Reject</button>
                </form>
              )}
              {canAccept && (
                <form action={accept}>
                  <button type="submit" className="btn btn--accept">Approve</button>
                </form>
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
              <Link href={`${base}?edit=1`} className="btn">Edit</Link>
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
                <form action={deprecate}>
                  <button type="submit" className="btn btn--ghost">Deprecate</button>
                </form>
              )}
              {canSupersede && supersedable.length > 0 && (
                <form action={supersede.bind(null, workspaceId, decisionId)} style={{ display: "flex", gap: "0.4rem" }}>
                  <select className="select" name="supersededId" required defaultValue="" style={{ width: "auto" }}>
                    <option value="" disabled>Supersede…</option>
                    {supersedable.map((d) => (
                      <option key={d.id} value={d.id}>
                        ADR-{String(d.number).padStart(3, "0")} — {d.title}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn">Supersede</button>
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
                  ADR-{String(supersededBy.number).padStart(3, "0")} — {supersededBy.title}
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
