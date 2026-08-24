import { notFound, redirect } from "next/navigation";
import { DecisionEditor } from "@/components/DecisionEditor";
import { LiveReferenceField } from "@/components/LiveReferenceField";
import {
  canEditContent,
  capabilitiesFor,
  decisionLabel,
  decisionService,
  formatRange,
} from "@/lib/decisions";
import type { Json } from "@/lib/versioning";
import { requireUser } from "@/lib/session";
import { revise } from "../../../actions";

function field(body: Json, key: string): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const value = body[key];
    return typeof value === "string" ? value : "";
  }
  return "";
}

/**
 * Revising a decision is its own page, not a mode the read view slips into.
 *
 * Inline editing left the properties, the review banner and the tabs stacked
 * above the editor — chrome about a decision, sitting on top of the act of
 * rewriting it, with two Edit affordances visible at once. Writing deserves the
 * same undistracted page whether the document is new or already numbered.
 */
export default async function EditDecisionPage({
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

  const base = `/app/${workspaceId}/${decisionId}`;
  const editable = canEditContent(
    decision.status,
    { id: user.id, capabilities: capabilitiesFor(role) },
    decision.authorId === user.id,
  );
  // An accepted ADR is immutable — you supersede it, you do not edit it. Anyone
  // arriving here by URL goes back to the document rather than seeing a form
  // whose submit would be refused.
  if (!editable.ok) redirect(base);

  const [content, references, repos, workspace] = await Promise.all([
    decisionService.contentHistory(decisionId),
    decisionService.listReferences(decisionId),
    decisionService.listWorkspaceRepos(workspaceId),
    decisionService.getWorkspace(workspaceId),
  ]);

  const body = content.at(-1)?.state ?? {};
  const citable = repos.map((r) => ({
    repo: `${r.owner}/${r.name}`,
    branch: r.defaultBranch,
  }));

  return (
    <DecisionEditor
      action={revise.bind(null, workspaceId, decisionId)}
      cancelHref={base}
      submitLabel="Save revision"
      defaults={{
        context: field(body, "context"),
        decision: field(body, "decision"),
        consequences: field(body, "consequences"),
      }}
      draftKey={`${workspaceId}:${decisionId}`}
      citable={citable}
      headingKey={decisionLabel(workspace?.key ?? "ADR", decision.number)}
      headingTitle={decision.title}
      status={decision.status}
      note="Saved as a new revision — the previous version stays in the history."
      /* References are not versioned, so they are managed live rather than
         submitted with the form — but this is the only place they can be
         changed, which is why the panel lives here and not on the document. */
      previewCited={references
        .filter((r) => r.kind === "file" && r.repo && r.path)
        .map((r) => ({
          repo: r.repo!,
          path: r.path!,
          lines:
            r.startLine && r.endLine
              ? formatRange({ start: r.startLine, end: r.endLine })
              : null,
        }))}
      referencesSlot={
        <LiveReferenceField
          workspaceId={workspaceId}
          decisionId={decisionId}
          chips={references.map((r) => ({
            key: r.id,
            repo: r.repo ?? "",
            path: r.path ?? r.label ?? r.url ?? "",
            lines:
              r.startLine && r.endLine
                ? formatRange({ start: r.startLine, end: r.endLine })
                : null,
          }))}
        />
      }
    />
  );
}
