"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import styles from "@/app/app/shell.module.css";

export function UserMenu({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const initial = (user.name || user.email).charAt(0).toUpperCase() || "?";

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className={styles.userWrap} ref={ref}>
      <button
        type="button"
        className={styles.avatarBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.avatar}>{initial}</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
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
        </div>
      )}
    </div>
  );
}
