import { notFound } from "next/navigation";
import { DecisionEditor } from "@/components/DecisionEditor";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import { discardDraft, propose, saveDraft } from "../../actions";

export default async function NewDecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { workspaceId } = await params;
  const { draft: draftId } = await searchParams;
  const user = await requireUser();

  const role = await decisionService.roleOf(workspaceId, user.id);
  if (!role) notFound();

  const workspace = await decisionService.getWorkspace(workspaceId);
  if (!workspace) notFound();

  const nextKey = await decisionService.peekNextLabel(workspaceId);
  const repos = await decisionService.listWorkspaceRepos(workspaceId);

  // Only ever the acting user's own draft — `getDraft` returns null otherwise,
  // so a guessed id opens an empty compose screen rather than someone's work.
  const draft = draftId ? await decisionService.getDraft(draftId, user.id) : null;

  return (
    <DecisionEditor
      action={propose.bind(null, workspaceId)}
      onSaveDraft={saveDraft.bind(null, workspaceId)}
      cancelHref={`/app/${workspaceId}`}
      submitLabel="Propose decision"
      withTitle
      defaultTitle={draft?.title ?? ""}
      defaults={draft?.body ?? { context: "", decision: "", consequences: "" }}
      defaultCited={draft?.refs ?? []}
      workspaceId={workspaceId}
      citable={repos.map((r) => ({
        repo: `${r.owner}/${r.name}`,
        branch: r.defaultBranch,
      }))}
      repoIds={repos.map((r) => ({ id: r.id, repo: `${r.owner}/${r.name}` }))}
      draftId={draft?.id}
      onDiscardDraft={async (id) => {
        "use server";
        await discardDraft(workspaceId, id);
      }}
      draftKey={`${workspaceId}:${draft?.id ?? "new"}`}
      nextKey={nextKey ?? undefined}
    />
  );
}
