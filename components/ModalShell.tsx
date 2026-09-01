"use client";

import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import styles from "./Modal.module.css";

export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // The trap holds onClose in a ref of its own, so an inline arrow from a caller
  // does not re-run it.
  useFocusTrap(true, panel, onClose);

  // The page behind a modal should not scroll under it. Restoring the previous
  // value rather than clearing it keeps a modal opened from inside another one
  // from unlocking the page when only the inner one closes.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Dismiss on a press that both starts and ends on the backdrop. Closing on
  // the click alone meant a drag that began in a field and released outside it
  // dismissed the dialog and discarded what had been typed.
  const pressedBackdrop = useRef(false);

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className={styles.panelTitle}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
