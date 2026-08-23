import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import {
  allowedTransitions,
  canEditContent,
  capabilitiesFor,
  decisionService,
} from "@/lib/decisions";
import type { Change, Json } from "@/lib/versioning";
import { requireUser } from "@/lib/session";
import { usersById } from "@/lib/users";
import { changeStatus, revise, supersede } from "../../actions";
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
}: {
  params: Promise<{ workspaceId: string; decisionId: string }>;
}) {
  const { workspaceId, decisionId } = await params;
  const user = await requireUser();

  const role = await decisionService.roleOf(workspaceId, user.id);
  if (!role) notFound();

  const decision = await decisionService.getDecision(decisionId);
  if (!decision || decision.workspaceId !== workspaceId) notFound();

  const actor = { id: user.id, capabilities: capabilitiesFor(role) };
  const [content, transitions, all] = await Promise.all([
    decisionService.contentHistory(decisionId),
    decisionService.statusHistory(decisionId),
    decisionService.listDecisions(workspaceId),
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

  // Superseding is reached via the picker, never a bare lifecycle button.
  const moves = allowedTransitions(decision.status).filter(
    (rule) =>
      rule.to !== "superseded" && actor.capabilities.includes(rule.capability),
  );
  const canSupersede =
    decision.status === "accepted" && actor.capabilities.includes("supersede");
  const supersedable = all.filter(
    (d) => d.id !== decision.id && d.status === "accepted",
  );
  const supersededBy = decision.supersededById
    ? all.find((d) => d.id === decision.supersededById)
    : null;

  const journey = transitions.map((t) => t.toStatus);
  const adrNumber = `ADR-${String(decision.number).padStart(3, "0")}`;

  return (
    <div>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.crumbs}>
            <Link href="/app">workspaces</Link>
            <span className={styles.sep}>/</span>
            <Link href={`/app/${workspaceId}`}>decisions</Link>
            <span className={styles.sep}>/</span>
            <span className="mono">{adrNumber}</span>
          </p>
          <h1 className={styles.title}>{decision.title}</h1>
          <div className={styles.stepper}>
            {journey.map((status, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className={styles.stepLine} />}
                <span className={`${styles.step} ${styles.stepOn}`}>
                  <span className={styles.stepDot} />
                  {status}
                </span>
              </span>
            ))}
          </div>
        </div>
        <StatusBadge status={decision.status} />
      </div>

      {supersededBy && (
        <p className={styles.supersedeNote}>
          Superseded by{" "}
          <Link href={`/app/${workspaceId}/${supersededBy.id}`}>
            ADR-{String(supersededBy.number).padStart(3, "0")} — {supersededBy.title}
          </Link>
        </p>
      )}

      <div className={styles.detail}>
        <div>
          <div className={styles.adrBody}>
            {(["context", "decision", "consequences"] as const).map((key) => (
              <div key={key} className={styles.adrBlock}>
                <h3>{key}</h3>
                <p>{field(body, key) || "—"}</p>
              </div>
            ))}
          </div>

          {editable.ok && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Revise</h2>
              </div>
              <form
                action={revise.bind(null, workspaceId, decisionId)}
                className={styles.form}
              >
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
                  <button type="submit" className="btn">Save revision</button>
                </div>
              </form>
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Decision history</h2>
            </div>
            <div className={styles.timeline}>
              {transitions.map((t) => (
                <div key={t.id} className={styles.tlItem}>
                  <div className={styles.tlHead}>
                    <StatusBadge status={t.toStatus} />
                    <span className={styles.tlMsg}>
                      {t.fromStatus ? `from ${t.fromStatus}` : "proposed"} by{" "}
                      {nameOf(t.actorId)}
                    </span>
                  </div>
                  <span className={styles.tlMeta}>{when(t.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Content history</h2>
            </div>
            <div className={styles.timeline}>
              {content.map((version) => (
                <div key={version.id} className={styles.tlItem}>
                  <div className={styles.tlHead}>
                    <span className={styles.tlMsg}>{version.message}</span>
                    <span className={styles.tlMeta}>{when(version.createdAt)}</span>
                  </div>
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

        <aside className={styles.rail}>
          <div className={styles.railCard}>
            <p className={styles.railLabel}>Details</p>
            <dl>
              <div className={styles.metaRow}>
                <dt>Status</dt>
                <dd><StatusBadge status={decision.status} /></dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Author</dt>
                <dd>{nameOf(decision.authorId)}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Created</dt>
                <dd>{when(decision.createdAt)}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Updated</dt>
                <dd>{when(decision.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          {(moves.length > 0 || (canSupersede && supersedable.length > 0)) && (
            <div className={styles.railCard}>
              <p className={styles.railLabel}>Actions</p>
              <div className={styles.railActions}>
                {moves.map((rule) => {
                  const act = changeStatus.bind(null, workspaceId, decisionId, rule.to);
                  const label =
                    rule.to === "accepted"
                      ? "Accept"
                      : rule.to === "rejected"
                        ? "Reject"
                        : "Deprecate";
                  return (
                    <form key={rule.to} action={act}>
                      <button
                        type="submit"
                        className={`btn ${rule.to === "accepted" ? "btn--primary" : rule.to === "rejected" ? "btn--danger" : ""}`}
                        style={{ width: "100%" }}
                      >
                        {label}
                      </button>
                    </form>
                  );
                })}

                {canSupersede && supersedable.length > 0 && (
                  <form
                    action={supersede.bind(null, workspaceId, decisionId)}
                    className={styles.form}
                  >
                    <label className="field">
                      <span>Supersedes…</span>
                      <select className="select" name="supersededId" required defaultValue="">
                        <option value="" disabled>
                          Choose a decision
                        </option>
                        {supersedable.map((d) => (
                          <option key={d.id} value={d.id}>
                            ADR-{String(d.number).padStart(3, "0")} — {d.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="btn" style={{ width: "100%" }}>
                      Supersede
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
