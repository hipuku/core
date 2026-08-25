"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import styles from "./SubmitButton.module.css";

/**
 * A submit button that knows its form is busy.
 *
 * Every mutation here is a server action: a round trip, then a revalidation.
 * Without feedback the button looks inert for the whole of it, so people press
 * it again — and on a slow connection the second press lands before the first
 * has returned. Disabling while pending removes both the doubt and the double
 * submit.
 *
 * `useFormStatus` reads the enclosing form, so this has to be a child of it
 * rather than the form itself.
 */
export function SubmitButton({
  children,
  className = "btn",
  /** Shown in place of the label while the action is in flight. */
  pendingLabel,
  ...rest
}: React.ComponentProps<"button"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <button {...rest} type="submit" className={className} disabled={pending || rest.disabled}>
      {pending ? (
        <>
          <Loader2 size={15} className={styles.spinner} />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
