"use client";

import { useCallback, useEffect, useId, useRef } from "react";
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

  // Every caller passes an inline arrow, so `onClose` is a new function each
  // render. Handed straight to the trap it would tear the effect down and set
  // it up again on every keystroke inside the dialog, stealing focus back to
  // the first field. The ref keeps the callback current behind a stable one.
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  }, [onClose]);
  const close = useCallback(() => latestClose.current(), []);

  useFocusTrap(true, panel, close);

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
