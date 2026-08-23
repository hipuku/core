"use client";

import { useMemo, useState } from "react";
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
  const strength = useMemo(
    () => (showMeter ? scorePassword(value) : null),
    [showMeter, value],
  );

  return (
    <div className={styles.wrap}>
      <label className="field">
        <span>Password</span>
        <div className={styles.inputRow}>
          <input
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
          >
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      {showMeter && value.length > 0 && strength && (
        <div className={styles.meter} data-score={strength.score}>
          <div className={styles.bars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`${styles.bar} ${i <= strength.score ? styles.barOn : ""}`}
              />
            ))}
          </div>
          <p className={styles.readout}>
            <span className={styles.label}>{strength.label}</span>
            {strength.hint && <span className={styles.hint}> · {strength.hint}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
