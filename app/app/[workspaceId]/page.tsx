import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import { usersById } from "@/lib/users";
import { inviteMember, propose } from "../actions";
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
  const proposeHere = propose.bind(null, workspaceId);

  const members = await decisionService.listMembers(workspaceId);
  const memberUsers = await usersById(members.map((m) => m.userId));
  const inviteHere = inviteMember.bind(null, workspaceId);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.crumbs}>
            <Link href="/app">workspaces</Link> / {workspace.name}
          </p>
          <h1 className={styles.h1}>Decisions</h1>
        </div>
        <p className={styles.crumbs}>
          you are {role === "author" ? "an" : "a"} {role}
        </p>
      </header>

      {decisions.length === 0 ? (
        <p className={styles.empty}>No decisions recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {decisions.map((decision) => (
            <li key={decision.id}>
              <Link
                href={`/app/${workspaceId}/${decision.id}`}
                className={styles.row}
              >
                <span className={styles.num}>
                  ADR-{String(decision.number).padStart(3, "0")}
                </span>
                <span className={styles.rowTitle}>{decision.title}</span>
                <StatusBadge status={decision.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Propose a decision</h2>
        <form action={proposeHere} className={styles.form}>
          <label>
            <span>Title</span>
            <input name="title" required placeholder="Use Postgres for primary storage" />
          </label>
          <label>
            <span>Context</span>
            <textarea name="context" rows={3} placeholder="What is the situation that forces a decision?" />
          </label>
          <label>
            <span>Decision</span>
            <textarea name="decision" rows={3} placeholder="What have we decided to do?" />
          </label>
          <label>
            <span>Consequences</span>
            <textarea name="consequences" rows={3} placeholder="What becomes easier or harder as a result?" />
          </label>
          <div className={styles.actionRow}>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Propose
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Members</h2>
        <ul className={styles.list}>
          {members.map((member) => {
            const person = memberUsers.get(member.userId);
            return (
              <li key={member.userId} className={styles.row}>
                <span className={styles.rowTitle}>
                  {person?.name ?? "Unknown"}
                  <span className={styles.num}> {person?.email}</span>
                </span>
                <span className={styles.badge}>{member.role}</span>
              </li>
            );
          })}
        </ul>

        {role === "maintainer" && (
          <form action={inviteHere} className={styles.form} style={{ marginTop: "1rem" }}>
            <label>
              <span>Add a member by email</span>
              <input
                type="email"
                name="email"
                required
                placeholder="teammate@example.com"
              />
            </label>
            <label>
              <span>Role</span>
              <select name="role" defaultValue="author">
                <option value="author">author — can propose and revise</option>
                <option value="maintainer">
                  maintainer — can also accept, reject, supersede
                </option>
              </select>
            </label>
            <div className={styles.actionRow}>
              <button type="submit" className={styles.btn}>
                Add member
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
