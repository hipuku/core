"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
 */
export function Dropdown({
  name,
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={styles.dropdown} ref={rootRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
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
        <ul className={styles.panel} role="listbox">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`${styles.option} ${o.value === value ? styles.optionOn : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className={styles.optLabel}>{o.label}</span>
                {o.hint && <span className={styles.optHint}>{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
