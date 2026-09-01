"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keep Tab inside an overlay while it is open, and give focus back to whatever
 * opened it on close.
 *
 * Without this, Tab walks out of the overlay into the live page behind it, and
 * closing one drops focus to <body>: after confirming a delete you restarted
 * from the top of the document. Ported from vault, where the same shell was
 * hand-rolled first and the docstring already read "every hand-rolled copy of
 * this shell handled Escape and none of them trapped focus or gave it back".
 * This is the second copy, so the signature is kept identical to vault's on
 * purpose: the two want to stay diffable until one of them moves to haus.
 *
 * `onEscape` is held in a ref rather than taken as a dependency. Every caller passes
 * an inline arrow, so as a dependency it tears the effect down and sets it up again on
 * every render of the parent: the cleanup hands focus back to the opener and the setup
 * pulls it to the first field, so a click inside an open modal bounced focus out of
 * whatever the user was using. ModalShell carried this workaround itself at first; it
 * belongs here, where vault's copy has it too.
 *
 * @param open      whether the overlay is showing
 * @param container the element to trap within
 * @param onEscape  called on Escape, if the caller wants it handled here
 */
export function useFocusTrap(
  open: boolean,
  container: React.RefObject<HTMLElement | null>,
  onEscape?: () => void,
): void {
  const latestEscape = useRef(onEscape);
  useEffect(() => {
    latestEscape.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = container.current;

    // The first field if there is one, otherwise the container, so the next Tab
    // starts inside rather than at the top of the page. The container needs a
    // tabIndex of -1 for that fallback to land anywhere.
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        latestEscape.current?.();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open, container]);
}
