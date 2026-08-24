"use client";

import { useEffect } from "react";

/**
 * Catch in-app navigation away from unsaved work.
 *
 * `beforeunload` only covers leaving the site — a reload, a closed tab. Client
 * routing never touches it, so the topbar's back arrow, the workspace name and
 * any other link would silently discard a half-written decision. The App Router
 * exposes no navigation event to hook, so this intercepts the click itself, in
 * the capture phase, before the router sees it.
 *
 * Deliberately narrow: it only claims plain left-clicks on same-origin links.
 * A modified click (new tab), a download, an external target and anything the
 * user has already handled are all left alone — a guard that swallows those
 * feels broken rather than protective.
 */
export function useUnsavedGuard({
  when,
  onBlocked,
}: {
  when: boolean;
  onBlocked: (href: string) => void;
}): void {
  useEffect(() => {
    if (!when) return;

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      // Not a plain left-click: the browser is about to do something other than
      // navigate this tab.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const target = new URL(href, window.location.href);
      if (target.origin !== window.location.origin) return;
      // A jump within this page is not leaving it.
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      // Stop the router's own listener, which shares this target.
      event.stopPropagation();
      onBlocked(target.pathname + target.search);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [when, onBlocked]);
}
