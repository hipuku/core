"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** How long a typeahead buffer survives before the next letter starts fresh. */
const TYPEAHEAD_MS = 500;

export interface ListboxOptions {
  /** Whether the panel is showing. */
  open: boolean;
  /** Option labels, in render order. Used for typeahead and for the bounds. */
  labels: readonly string[];
  /** Index of the selected option, or -1 for none. */
  selectedIndex: number;
  /** Commit the option at this index. The caller closes the panel. */
  onSelect: (index: number) => void;
  /** Open or close the panel, when a key does that as well as move. */
  onOpenChange: (open: boolean) => void;
  /** Prefix for the generated option ids; must be unique on the page. */
  baseId: string;
}

export interface Listbox {
  /** The visually highlighted option. Not DOM focus: focus stays on the trigger. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** `id` for the option at `index`, to be matched by `activeDescendant`. */
  optionId: (index: number) => string;
  /** For `aria-activedescendant` on the trigger. */
  activeDescendant: string | undefined;
  /** `id` for the listbox element, to be matched by `controls`. */
  listId: string;
  /** For `aria-controls` on the trigger, only while the panel exists. */
  controls: string | undefined;
  /** Put on the trigger. Handles arrows, Home, End, Enter, Space and typeahead. */
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * The keyboard half of the WAI-ARIA listbox pattern, for a button that opens a
 * panel of options.
 *
 * Focus stays on the trigger the whole time and the highlighted option is
 * announced through `aria-activedescendant`, which is what lets the options be
 * plain `<li role="option">` rather than buttons: `role="option"` has to be a
 * direct child of the listbox, so any element that can hold DOM focus in
 * between makes the structure invalid.
 *
 * Arrows, Home and End move; Enter and Space commit; a printable key jumps to
 * the next option starting with what has been typed, wrapping so repeatedly
 * pressing one letter cycles through the options beginning with it. Escape and
 * outside-dismissal are deliberately not here: both components that use this
 * already own them, and one of them shares that ownership with every other
 * popover in its app.
 *
 * Ported alongside vault's `useListbox`, with the same signature, so the two
 * stay diffable until one of them moves to haus.
 */
export function useListbox({
  open,
  labels,
  selectedIndex,
  onSelect,
  onOpenChange,
  baseId,
}: ListboxOptions): Listbox {
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [wasOpen, setWasOpen] = useState(open);
  const typed = useRef({ buffer: "", at: 0 });

  // Callers pass inline arrows, so these would otherwise re-run the effects and
  // rebuild the handler on every render.
  const latest = useRef({ onSelect, onOpenChange });
  useEffect(() => {
    latest.current = { onSelect, onOpenChange };
  }, [onSelect, onOpenChange]);

  const count = labels.length;
  const lower = useMemo(() => labels.map((l) => l.toLowerCase()), [labels]);

  // Opening starts on the current selection, so the first ArrowDown moves from
  // where the user is rather than from the top of a list they have scrolled
  // past. Adjusted during render rather than in an effect: an effect would
  // paint the old row first and then correct it.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }

  // A long list can open with the selected row below the fold. Found by id
  // rather than through a ref the caller attaches: the panel only exists while
  // the listbox is open, and the ids are already on the options for
  // aria-activedescendant to point at.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${baseId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, baseId]);

  const optionId = useCallback(
    (index: number) => `${baseId}-option-${index}`,
    [baseId],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { onSelect: select, onOpenChange: setOpen } = latest.current;
      const move = (next: number) => {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (count > 0) setActiveIndex(Math.min(Math.max(next, 0), count - 1));
      };

      switch (e.key) {
        case "ArrowDown":
          return move(activeIndex + 1);
        case "ArrowUp":
          return move(activeIndex - 1);
        case "Home":
          return move(0);
        case "End":
          return move(count - 1);
        case "Enter":
        case " ":
          e.preventDefault();
          if (!open) {
            setOpen(true);
          } else if (activeIndex >= 0 && activeIndex < count) {
            select(activeIndex);
          }
          return;
      }

      // Typeahead. One printable character, no modifier: anything else is a
      // shortcut the page or the browser owns.
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = Date.now();
      const buffer =
        now - typed.current.at > TYPEAHEAD_MS
          ? e.key.toLowerCase()
          : typed.current.buffer + e.key.toLowerCase();
      typed.current = { buffer, at: now };

      // One letter pressed repeatedly cycles through the options beginning
      // with it, the way a native <select> does, rather than searching for
      // "eee". Any other run of keys is a prefix and searches from the current
      // row, so the match found by "e" survives the "d" that follows it.
      const repeated = [...buffer].every((c) => c === buffer[0]);
      const needle = repeated ? buffer[0] : buffer;
      const from = repeated ? activeIndex + 1 : activeIndex;
      for (let i = 0; i < count; i++) {
        const at = (from + i + count) % count;
        if (lower[at].startsWith(needle)) {
          e.preventDefault();
          if (!open) setOpen(true);
          setActiveIndex(at);
          return;
        }
      }
    },
    [open, count, activeIndex, lower],
  );

  return {
    activeIndex,
    setActiveIndex,
    optionId,
    activeDescendant:
      open && activeIndex >= 0 && activeIndex < count
        ? optionId(activeIndex)
        : undefined,
    listId: `${baseId}-listbox`,
    controls: open ? `${baseId}-listbox` : undefined,
    onKeyDown,
  };
}
