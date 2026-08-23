import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import { usersById } from "@/lib/users";
import { inviteMember } from "../actions";
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
  const members = await decisionService.listMembers(workspaceId);
  const memberUsers = await usersById(members.map((m) => m.userId));

  const inviteHere = inviteMember.bind(null, workspaceId);
  const article = role === "author" ? "an" : "a";

  return (
    <div>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.crumbs}>
            <Link href="/app">workspaces</Link>
            <span className={styles.sep}>/</span>
            {workspace.name}
          </p>
          <h1 className={styles.title}>Decisions</h1>
          <p className={styles.sub}>
            You are {article} {role} in this workspace.
          </p>
        </div>
        <Link href={`/app/${workspaceId}/new`} className="btn btn--primary">
          New decision
        </Link>
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

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Members</h2>
        </div>
        <ul className={styles.list}>
          {members.map((member) => {
            const person = memberUsers.get(member.userId);
            return (
              <li key={member.userId} className={styles.memberRow}>
                <span className={styles.memberName}>
                  {person?.name ?? "Unknown"}
                  <span className={styles.memberEmail}>{person?.email}</span>
                </span>
                <span className={`pill pill--${member.role === "maintainer" ? "accepted" : "proposed"}`}>
                  {member.role}
                </span>
              </li>
            );
          })}
        </ul>

        {role === "maintainer" && (
          <form action={inviteHere} className={styles.form} style={{ marginTop: "1rem" }}>
            <label className="field">
              <span>Add a member by email</span>
              <input className="input" type="email" name="email" required placeholder="teammate@example.com" />
            </label>
            <label className="field">
              <span>Role</span>
              <select className="select" name="role" defaultValue="author">
                <option value="author">author — can propose and revise</option>
                <option value="maintainer">maintainer — can also accept, reject, supersede</option>
              </select>
            </label>
            <div className={styles.actions}>
              <button type="submit" className="btn">Add member</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
