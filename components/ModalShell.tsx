"use client";

import { useEffect, useRef } from "react";
import { Modal } from "haus-components";

/**
 * core's modal shell, composing haus's `Modal`. C3.
 *
 * It used to be a hand-rolled backdrop, focus trap and scroll lock. haus `Modal`
 * owns all three now, so this is a thin adapter that keeps the two behaviours
 * core decided on:
 *
 * · `dismissOnBackdrop={false}`. Every one of core's six modals is a form or a
 *   destructive confirmation, where a stray backdrop click should not throw the
 *   dialog away. That is also why haus Modal's backdrop dismiss, which has no
 *   drag-release guard, does not bite here: it is off.
 * · Focus lands on the first field, not the dialog. haus Modal focuses the
 *   dialog by default and offers `initialFocus` for a specific element. Rather
 *   than thread a ref through every call site — several of which open onto the
 *   custom Dropdown, which would then need to forward one — this effect focuses
 *   the first focusable in the body. Parent effects run after the child's, so it
 *   wins over Modal's own focus-on-open. haus Modal renders a close button in
 *   its header before the body, so that one is skipped by its label; a caller
 *   passing `initialFocus` opts out entirely and haus Modal handles it.
 */

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "iframe",
  "object",
  "embed",
  '[tabindex]:not([tabindex="-1"])',
  "[contenteditable]",
].join(",");

export function ModalShell({
  title,
  onClose,
  children,
  initialFocus,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A caller that named its own target lets haus Modal handle it.
    if (initialFocus) return;
    const focusables = dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    // The first body control, skipping haus Modal's own header close button.
    const target = focusables
      ? Array.from(focusables).find((el) => el.getAttribute("aria-label") !== "Close modal")
      : undefined;
    target?.focus();
  }, [initialFocus]);

  return (
    <Modal
      ref={dialog}
      open
      onClose={onClose}
      title={title}
      dismissOnBackdrop={false}
      initialFocus={initialFocus}
    >
      {children}
    </Modal>
  );
}
