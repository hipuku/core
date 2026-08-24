"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";
import styles from "@/app/app/shell.module.css";

export function TopBar({
  user,
  workspaces,
}: {
  user: { name: string; email: string };
  workspaces: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const match = pathname.match(/^\/app\/([^/]+)(\/.*)?$/);
  const workspaceId = match?.[1];
  const workspace = workspaceId
    ? workspaces.find((w) => w.id === workspaceId)
    : undefined;
  // Deeper than the workspace root (a decision, /new) → back to the workspace.
  const backHref = match?.[2] ? `/app/${workspaceId}` : "/app";

  return (
    <header className={styles.topbar}>
      {workspace ? (
        <div className={styles.leftCtx}>
          <Link href={backHref} className={styles.backBtn} aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <span className={styles.ctxName}>{workspace.name}</span>
        </div>
      ) : (
        <Link href="/app" className={styles.brand}>
          core
        </Link>
      )}
      <UserMenu user={user} />
    </header>
  );
}
