"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useListbox } from "@/lib/use-listbox";
import styles from "./Dropdown.module.css";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * A styled listbox standing in for `<select>`, whose native popup can't be
 * themed. `name` renders a hidden input so it still submits inside a plain
 * <form action>; omit it for a purely controlled use (e.g. FileBrowser).
 *
 * Keyboard behaviour lives in `useListbox`. Focus stays on the trigger while
 * the panel is open and the highlighted row is announced through
 * `aria-activedescendant`, which is why the options are `<li role="option">`
 * and not the buttons they used to be: `role="option"` has to be a direct child
 * of the listbox.
 */
export function Dropdown({
  name,
  value,
  onChange,
  options,
  placeholder = "Select…",
  label,
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  /**
   * Names the control. Required in practice: the trigger is a combobox, whose
   * name cannot come from its own contents the way a button's can, and a
   * wrapping <label> does not reach it either since a button is not labelable.
   */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const focusTrigger = useCallback(() => triggerRef.current?.focus(), []);

  const labels = useMemo(() => options.map((o) => o.label), [options]);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const listbox = useListbox({
    open,
    labels,
    selectedIndex,
    onSelect: (index) => {
      onChange(options[index].value);
      setOpen(false);
    },
    onOpenChange: setOpen,
    baseId,
  });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      // Escape returns focus to the trigger, which is where it already is for a
      // keyboard user and where a pointer user expects to find it next.
      if (e.key === "Escape") {
        setOpen(false);
        focusTrigger();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, focusTrigger]);

  const selected = options[selectedIndex];

  return (
    <div className={styles.dropdown} ref={rootRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        // A combobox rather than a plain button: it is the role that carries
        // aria-activedescendant, without which the highlighted row is announced
        // to nobody.
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listbox.controls}
        aria-activedescendant={listbox.activeDescendant}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={listbox.onKeyDown}
      >
        <span className={selected ? styles.triggerLabel : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </button>

      {open && (
        <ul
          id={listbox.listId}
          className={styles.panel}
          role="listbox"
          aria-label={label}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={listbox.optionId(i)}
              role="option"
              aria-selected={i === selectedIndex}
              data-active={i === listbox.activeIndex}
              className={`${styles.option} ${i === selectedIndex ? styles.optionOn : ""} ${
                i === listbox.activeIndex ? styles.optionActive : ""
              }`}
              // The trigger keeps focus, so a press here must not take it away
              // before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => listbox.setActiveIndex(i)}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                focusTrigger();
              }}
            >
              <span className={styles.optLabel}>{o.label}</span>
              {o.hint && <span className={styles.optHint}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
