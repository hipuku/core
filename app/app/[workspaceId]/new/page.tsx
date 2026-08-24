import Link from "next/link";
import { notFound } from "next/navigation";
import { decisionService } from "@/lib/decisions";
import { requireUser } from "@/lib/session";
import { propose } from "../../actions";
import styles from "../../app.module.css";

export default async function NewDecisionPage({
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

  return (
    <div className={styles.compose}>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.crumbs}>
            <Link href="/app">workspaces</Link>
            <span className={styles.sep}>/</span>
            <Link href={`/app/${workspaceId}`}>{workspace.name}</Link>
            <span className={styles.sep}>/</span>
            new
          </p>
          <h1 className={styles.title}>Propose a decision</h1>
          <p className={styles.sub}>
            It starts as a proposal. A maintainer reviews and accepts it.
          </p>
        </div>
      </div>

      <form action={propose.bind(null, workspaceId)} className={styles.form}>
        <p className={styles.hint}>
          Context, Decision, and Consequences support Markdown — including code
          blocks and <code>```mermaid</code> diagrams.
        </p>
        <label className="field">
          <span>Title</span>
          <input className="input" name="title" required placeholder="Use Postgres for primary storage" />
        </label>
        <label className="field">
          <span>Context</span>
          <textarea className="textarea" name="context" rows={4} placeholder="What situation forces a decision? What constraints matter?" />
        </label>
        <label className="field">
          <span>Decision</span>
          <textarea className="textarea" name="decision" rows={4} placeholder="What are we deciding to do?" />
        </label>
        <label className="field">
          <span>Consequences</span>
          <textarea className="textarea" name="consequences" rows={4} placeholder="What becomes easier or harder? What do we accept as a trade-off?" />
        </label>
        <div className={styles.actions}>
          <button type="submit" className="btn btn--primary">Propose decision</button>
          <Link href={`/app/${workspaceId}`} className="btn btn--ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
