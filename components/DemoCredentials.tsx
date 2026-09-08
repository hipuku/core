"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import styles from "./DemoCredentials.module.css";
import { IconButton, Callout } from "haus-components";

/**
 * The way in, on the page where someone needs it.
 *
 * A public demo whose credentials live in a README asks too much: the person
 * evaluating this arrived from a link and will not go hunting. Shown only where
 * sign-up is closed, so it never appears on a local install.
 *
 * Each value is a read-only field with its own copy button rather than loose
 * text: these exist to be moved into the form immediately above them, and
 * selecting a password by dragging across it is a needless way to start.
 */
export function DemoCredentials({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  return (
    // A Callout, not a Card. A tinted panel with a rule down one side and an
    // advisory message is what Callout is; it was drawn as a card because core
    // had no callout of its own to reach for.
    <Callout tone="info" className={styles.card}>
      <p className={styles.lead}>
        <strong>Read-only demo.</strong> Sign in with these to look around. You
        can write and save drafts; the decision log itself stays as it is.
      </p>
      <Field label="Email" value={email} />
      <Field label="Password" value={password} />
    </Callout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // Long enough to register, short enough that the button is ready again
      // before someone reaches for the second field.
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused outright, over plain http or by
      // permission. The value is selectable, so there is still a way through.
    }
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.value}
        value={value}
        readOnly
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
      />
      <IconButton
        icon={copied ? <Check size={14} /> : <Copy size={14} />}
        label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        title={copied ? "Copied" : "Copy"}
        variant="ghost"
        size="sm"
        onClick={copy}
      />
    </div>
  );
}
