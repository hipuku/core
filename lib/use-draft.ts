"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

/**
 * Local draft safety for the compose editor.
 *
 * Writing the reasoning behind an architectural decision is twenty minutes of
 * work, and until it is proposed it exists nowhere but this tab. A stray ⌘W, a
 * dev-server reload or a mis-clicked Cancel used to end it. The draft is kept in
 * `localStorage` — deliberately *not* on the server, because an unproposed draft
 * is not yet a decision and should not appear in anyone's workspace or history.
 *
 * A found draft is never silently applied: it is offered. Silently replacing
 * what someone sees on screen with older text is its own kind of data loss.
 */

const PREFIX = "core:draft:";
/** Older than this and the draft is more likely to confuse than to help. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Stored<T> {
  savedAt: number;
  data: T;
}

export interface Found<T> {
  data: T;
  savedAt: number;
}

export interface Draft<T> {
  /** A draft found in storage, offered for recovery. */
  found: Found<T> | null;
  /** Stop offering it — the editor has taken the contents. */
  dismiss: () => void;
  /** Forget it — after a successful submit, or a deliberate discard. */
  clear: () => void;
}

function read<T>(key: string): Found<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (typeof parsed?.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return { data: parsed.data, savedAt: parsed.savedAt };
  } catch {
    // Private browsing, a full quota, or a shape from an older build. A draft
    // that cannot be read is not an error worth showing anyone.
    return null;
  }
}

/**
 * `localStorage` is an external store, so it is read through
 * `useSyncExternalStore` rather than an effect that calls `setState`. That gets
 * the server snapshot right for free — there is no storage during SSR, so the
 * server renders "no draft" and the client re-reads after hydration, rather
 * than flashing a recovery banner into markup that never contained one.
 */
function createStore<T>(key: string) {
  let listeners: (() => void)[] = [];
  /** `undefined` means "not read yet"; `null` means "read, nothing there". */
  let snapshot: Found<T> | null | undefined;

  return {
    subscribe(listener: () => void) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
    getSnapshot(): Found<T> | null {
      // Cached: getSnapshot must return a stable reference between renders, or
      // React re-renders forever.
      if (snapshot === undefined) snapshot = read<T>(key);
      return snapshot;
    },
    getServerSnapshot(): Found<T> | null {
      return null;
    },
    set(next: Found<T> | null) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

export function useDraft<T>({
  key,
  value,
  pristine,
  enabled = true,
}: {
  /** Stable per document — the new-decision form and each revision differ. */
  key: string;
  /** Current editor contents, serialisable. */
  value: T;
  /** True while `value` still equals what the editor opened with. */
  pristine: boolean;
  enabled?: boolean;
}): Draft<T> {
  const storageKey = PREFIX + key;
  const store = useMemo(() => createStore<T>(storageKey), [storageKey]);
  const cleared = useRef(false);

  const found = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  // Persist on a short debounce: often enough that a crash costs a sentence,
  // rarely enough that it is a write per keystroke.
  useEffect(() => {
    if (!enabled || pristine || cleared.current) return;
    const timer = setTimeout(() => {
      try {
        const record: Stored<T> = { savedAt: Date.now(), data: value };
        window.localStorage.setItem(storageKey, JSON.stringify(record));
      } catch {
        // Out of quota, or storage denied. The unload guard below still stands.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [storageKey, value, pristine, enabled]);

  // The last line of defence: closing the tab or reloading with unsaved edits
  // gets the browser's own confirmation.
  useEffect(() => {
    if (!enabled || pristine) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pristine, enabled]);

  const clear = useCallback(() => {
    cleared.current = true;
    store.set(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* nothing to do — the draft simply ages out */
    }
  }, [storageKey, store]);

  const dismiss = useCallback(() => store.set(null), [store]);

  return { found: enabled ? found : null, dismiss, clear };
}
