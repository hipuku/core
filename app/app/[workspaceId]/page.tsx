import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RepoManager } from "@/components/RepoManager";
import { StatusBadge } from "@/components/StatusBadge";
import { ToastForm } from "@/components/ToastForm";
import { decisionService } from "@/lib/decisions";
import { getGithubToken } from "@/lib/github";
import { requireUser } from "@/lib/session";
import { usersById } from "@/lib/users";
import { deleteWorkspace, inviteMember, renameWorkspace } from "../actions";
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
  const repos = await decisionService.listWorkspaceRepos(workspaceId);
  const githubLinked = (await getGithubToken(user.id)) !== null;

  const inviteHere = inviteMember.bind(null, workspaceId);
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
        <Link href={`/app/${workspaceId}/new`} className="btn btn--primary">
          <Plus size={16} />
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
          <ToastForm action={inviteHere} className={styles.form} style={{ marginTop: "1rem" }}>
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
              <button type="submit" className="btn">
                <UserPlus size={16} />
                Add member
              </button>
            </div>
          </ToastForm>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Repositories</h2>
        </div>
        <RepoManager
          workspaceId={workspaceId}
          githubLinked={githubLinked}
          canManage={role === "maintainer"}
          repos={repos}
        />
      </section>

      {role === "maintainer" && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Workspace settings</h2>
          </div>
          <ToastForm action={renameWorkspace.bind(null, workspaceId)} className={styles.form}>
            <label className="field">
              <span>Rename workspace</span>
              <input className="input" name="name" defaultValue={workspace.name} required />
            </label>
            <div className={styles.actions}>
              <button type="submit" className="btn">
                <Pencil size={15} />
                Rename
              </button>
            </div>
          </ToastForm>
          <form action={deleteWorkspace.bind(null, workspaceId)} style={{ marginTop: "1.25rem" }}>
            <ConfirmButton
              className="btn btn--danger"
              message="Delete this workspace and all its decisions? This cannot be undone."
            >
              <Trash2 size={15} />
              Delete workspace
            </ConfirmButton>
          </form>
        </section>
      )}
    </div>
  );
}
