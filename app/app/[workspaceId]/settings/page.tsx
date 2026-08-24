import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { AddMemberModal } from "@/components/AddMemberModal";
import { AddRepoModal } from "@/components/AddRepoModal";
import { ConnectGithubButton } from "@/components/ConnectGithubButton";
import { DeleteWorkspaceModal } from "@/components/DeleteWorkspaceModal";
import { ToastForm } from "@/components/ToastForm";
import { decisionService } from "@/lib/decisions";
import { getGithubToken } from "@/lib/github";
import { requireUser } from "@/lib/session";
import { usersById } from "@/lib/users";
import { disconnectRepo, removeMember, renameWorkspace } from "../../actions";
import styles from "../../app.module.css";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();

  const role = await decisionService.roleOf(workspaceId, user.id);
  if (role !== "maintainer") redirect(`/app/${workspaceId}`);

  const workspace = await decisionService.getWorkspace(workspaceId);
  if (!workspace) redirect("/app");

  const members = await decisionService.listMembers(workspaceId);
  const memberUsers = await usersById(members.map((m) => m.userId));
  const repos = await decisionService.listWorkspaceRepos(workspaceId);
  const githubLinked = (await getGithubToken(user.id)) !== null;

  return (
    <div style={{ maxWidth: "42rem" }}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.sub}>
            Manage this workspace, its members and repositories.
          </p>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>General</h2>
        </div>
        <ToastForm action={renameWorkspace.bind(null, workspaceId)} className={styles.form}>
          <label className="field">
            <span>Workspace name</span>
            <input className="input" name="name" defaultValue={workspace.name} required />
          </label>
          <div className={styles.actions}>
            <button type="submit" className="btn btn--primary">
              <Check size={16} />
              Save
            </button>
          </div>
        </ToastForm>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Members</h2>
          <AddMemberModal workspaceId={workspaceId} />
        </div>
        <ul className={styles.list}>
          {members.map((member) => {
            const person = memberUsers.get(member.userId);
            const isOwner = workspace.ownerId === member.userId;
            return (
              <li key={member.userId} className={styles.memberRow}>
                <span className={styles.memberName}>
                  {person?.name ?? "Unknown"}
                  <span className={styles.memberEmail}>{person?.email}</span>
                </span>
                <span className={`pill pill--${member.role === "maintainer" ? "accepted" : "proposed"}`}>
                  {member.role}
                </span>
                {!isOwner && (
                  <ToastForm action={removeMember.bind(null, workspaceId, member.userId)}>
                    <button type="submit" className={styles.refRemove} aria-label="Remove member">
                      ×
                    </button>
                  </ToastForm>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Repositories</h2>
          {githubLinked ? (
            <AddRepoModal workspaceId={workspaceId} />
          ) : (
            <ConnectGithubButton />
          )}
        </div>
        {repos.length === 0 ? (
          <p className={styles.hint}>
            No repositories connected.
            {!githubLinked && " Connect GitHub to link one."}
          </p>
        ) : (
          <ul className={styles.list}>
            {repos.map((repo) => (
              <li key={repo.id} className={styles.memberRow}>
                <span className={styles.memberName}>
                  {repo.owner}/{repo.name}
                  <span className={styles.memberEmail}>{repo.defaultBranch}</span>
                </span>
                <ToastForm action={disconnectRepo.bind(null, workspaceId, repo.id)}>
                  <button type="submit" className={styles.refRemove} aria-label="Disconnect repository">
                    ×
                  </button>
                </ToastForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Danger zone</h2>
        </div>
        <DeleteWorkspaceModal workspaceId={workspaceId} name={workspace.name} />
      </section>
    </div>
  );
}
