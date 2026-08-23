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
  return `${change.op} ${at}${
    value === undefined ? "" : ` = ${JSON.stringify(value)}`
  }`;
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

  const body = content.at(-1)?.state ?? {};
  const editable = canEditContent(
    decision.status,
    actor,
    decision.authorId === user.id,
  );

  // Superseding is reached through the picker below (choosing which earlier decision
  // this one replaces), never as a bare lifecycle button, so exclude it here.
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.crumbs}>
            <Link href="/app">workspaces</Link> /{" "}
            <Link href={`/app/${workspaceId}`}>decisions</Link> / ADR-
            {String(decision.number).padStart(3, "0")}
          </p>
          <h1 className={styles.h1}>{decision.title}</h1>
        </div>
        <StatusBadge status={decision.status} />
      </header>

      {supersededBy && (
        <p className={styles.supersedeNote}>
          Superseded by{" "}
          <Link href={`/app/${workspaceId}/${supersededBy.id}`}>
            ADR-{String(supersededBy.number).padStart(3, "0")} — {supersededBy.title}
          </Link>
          .
        </p>
      )}

      <div className={styles.body}>
        {(["context", "decision", "consequences"] as const).map((key) => (
          <div key={key} className={styles.bodyBlock}>
            <h3>{key}</h3>
            <p>{field(body, key) || "—"}</p>
          </div>
        ))}
      </div>

      {(moves.length > 0 || canSupersede) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Lifecycle</h2>
          <div className={styles.actionRow}>
            {moves.map((rule) => {
              const act = changeStatus.bind(null, workspaceId, decisionId, rule.to);
              return (
                <form key={rule.to} action={act}>
                  <button
                    type="submit"
                    className={`${styles.btn} ${rule.to === "accepted" ? styles.btnPrimary : ""}`}
                  >
                    {rule.to === "accepted"
                      ? "Accept"
                      : rule.to === "rejected"
                        ? "Reject"
                        : "Deprecate"}
                  </button>
                </form>
              );
            })}
          </div>

          {canSupersede && supersedable.length > 0 && (
            <form
              action={supersede.bind(null, workspaceId, decisionId)}
              className={styles.form}
              style={{ marginTop: "1rem" }}
            >
              <label>
                <span>This decision supersedes…</span>
                <select name="supersededId" required defaultValue="">
                  <option value="" disabled>
                    Choose an accepted decision
                  </option>
                  {supersedable.map((d) => (
                    <option key={d.id} value={d.id}>
                      ADR-{String(d.number).padStart(3, "0")} — {d.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.actionRow}>
                <button type="submit" className={styles.btn}>
                  Supersede
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {editable.ok && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Revise</h2>
          <form
            action={revise.bind(null, workspaceId, decisionId)}
            className={styles.form}
          >
            <label>
              <span>Context</span>
              <textarea name="context" rows={3} defaultValue={field(body, "context")} />
            </label>
            <label>
              <span>Decision</span>
              <textarea name="decision" rows={3} defaultValue={field(body, "decision")} />
            </label>
            <label>
              <span>Consequences</span>
              <textarea
                name="consequences"
                rows={3}
                defaultValue={field(body, "consequences")}
              />
            </label>
            <div className={styles.actionRow}>
              <button type="submit" className={styles.btn}>
                Save revision
              </button>
            </div>
          </form>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Decision history</h2>
        <ul className={styles.trail}>
          {transitions.map((t) => (
            <li key={t.id} className={styles.trailItem}>
              <StatusBadge status={t.toStatus} />
              <span>
                {t.fromStatus ? `from ${t.fromStatus}` : "proposed"}
                <span className={styles.trailMeta}>
                  {" "}
                  · {new Date(t.createdAt).toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Content history</h2>
        <ul className={styles.trail}>
          {content.map((version) => (
            <li key={version.id} className={styles.trailItem} style={{ flexDirection: "column", gap: "0.3rem", alignItems: "flex-start" }}>
              <span>
                {version.message}
                <span className={styles.trailMeta}>
                  {" "}
                  · {new Date(version.createdAt).toLocaleString()}
                </span>
              </span>
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
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
