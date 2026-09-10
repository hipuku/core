"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Popover } from "haus-components";
import { authClient } from "@/lib/auth-client";
import styles from "@/app/app/shell.module.css";

export function UserMenu({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  return (
    <div className={styles.userWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.avatarBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.name || user.email} size="sm" />
      </button>
      {/* haus Popover owns the outside-click, the Escape and the placement this
          component used to hand-roll; role="menu" makes it a menu rather than a
          panel. width="auto" sizes to the items. */}
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        role="menu"
        align="end"
        width="auto"
        aria-label="Account menu"
        className={styles.menu}
      >
        <div className={styles.menuHead}>
          <div className={styles.menuName}>{user.name}</div>
          <div className={styles.menuEmail}>{user.email}</div>
        </div>
        <button
          type="button"
          className={styles.menuItem}
          role="menuitem"
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </Popover>
    </div>
  );
}
