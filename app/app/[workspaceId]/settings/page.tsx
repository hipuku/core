import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { AddMemberModal } from "@/components/AddMemberModal";
import { AddRepoModal } from "@/components/AddRepoModal";
import { ConnectGithubButton } from "@/components/ConnectGithubButton";
import { DeleteWorkspaceModal } from "@/components/DeleteWorkspaceModal";
import { ToastForm } from "@/components/ToastForm";
import { decisionService } from "@/lib/decisions";
import { getGithubToken } from "@/lib/github";
import { githubDisabled } from "@/lib/demo";
import { requireUser } from "@/lib/session";
import { usersById } from "@/lib/users";
import {
  disconnectRepo,
  removeMember,
  updateWorkspaceGeneral,
} from "../../actions";
import styles from "../../app.module.css";
import { Input } from "haus-components";
import { SubmitButton } from "@/components/SubmitButton";
import { SubmitIconButton } from "@/components/SubmitIconButton";

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
  const githubOff = githubDisabled();

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
        <ToastForm
          action={updateWorkspaceGeneral.bind(null, workspaceId)}
          className={styles.form}
        >
          <Input
            label="Workspace name"
            name="name"
            defaultValue={workspace.name}
            required
          />
          <Input
            label="Decision key"
            name="key"
            defaultValue={workspace.key}
            maxLength={6}
            hint={`Decisions are labelled ${workspace.key}-001, ${workspace.key}-002, …`}
            style={{ maxWidth: "10rem", textTransform: "uppercase" }}
          />
          <div className={styles.actions}>
            <SubmitButton variant="primary">
              <Check size={16} />
              Save
            </SubmitButton>
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
                    <SubmitIconButton className="iconbtn iconbtn--danger" aria-label="Remove member">
                      ×
                    </SubmitIconButton>
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
            // Offering a Connect button that cannot work is worse than
            // offering nothing; the seeded repos still display either way.
            !githubOff && <ConnectGithubButton variant="secondary" />
          )}
        </div>
        {repos.length === 0 ? (
          <p className={styles.hint}>
            No repositories connected.
            {githubOff
              ? " GitHub linking is switched off on this deployment."
              : !githubLinked && " Connect GitHub to link one."}
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
                  <SubmitIconButton className="iconbtn iconbtn--danger" aria-label="Disconnect repository">
                    ×
                  </SubmitIconButton>
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
