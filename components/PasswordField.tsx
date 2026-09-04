"use client";

import { useId, useMemo, useState } from "react";
import { scorePassword } from "@/lib/password-strength";
import styles from "./PasswordField.module.css";

export function PasswordField({
  value,
  onChange,
  showMeter = false,
  autoComplete,
  minLength,
}: {
  value: string;
  onChange: (value: string) => void;
  showMeter?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  const [reveal, setReveal] = useState(false);
  const id = useId();
  const strength = useMemo(
    () => (showMeter ? scorePassword(value) : null),
    [showMeter, value],
  );

  return (
    <div className={styles.wrap}>
      {/* Explicit association, and the toggle outside the label.
          Wrapping both controls made the label's text content "Password Show",
          which is the input's accessible name: a screen reader announced the
          field as "Password Show, edit text". It also meant a click on the
          toggle was a click on the label, so the browser moved focus into the
          input on every reveal. Found by an end-to-end test that could not
          address the field by its name. */}
      <div className="field">
        <label htmlFor={id}>Password</label>
        <div className={styles.inputRow}>
          <input
            id={id}
            className="input"
            type={reveal ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required
            minLength={minLength}
            autoComplete={autoComplete}
          />
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide password" : "Show password"}
            aria-controls={id}
          >
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {showMeter && strength && (
        <div className={styles.meter} data-score={value ? strength.score : -1}>
          <div className={styles.bars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`${styles.bar} ${value && i <= strength.score ? styles.barOn : ""}`}
              />
            ))}
          </div>
          <p className={styles.readout}>
            {value && (
              <>
                <span className={styles.label}>{strength.label}</span>
                {strength.hint && (
                  <span className={styles.hint}> · {strength.hint}</span>
                )}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
