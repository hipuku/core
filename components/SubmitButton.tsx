"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "haus-components";

/**
 * The half of haus `ButtonProps` that renders a real button.
 *
 * `ButtonProps` became a union with `asChild` (haus#57). A submit button is
 * never a cloned child, so the wrapper takes the non-`asChild` half rather than
 * the whole union: with the union, passing the props straight through fails
 * because the compiler cannot rule out the `asChild` branch. haus#66.
 */
type ButtonOwnProps = Extract<ButtonProps, { asChild?: false }>;

/**
 * A submit button that knows its form is busy. Composes haus `Button`. C3.
 *
 * Every mutation here is a server action: a round trip, then a revalidation.
 * Without feedback the button looks inert for the whole of it, so people press
 * it again, and on a slow connection the second press lands before the first
 * has returned. Disabling while pending removes both the doubt and the double
 * submit.
 *
 * `useFormStatus` reads the enclosing form, so this has to be a child of it
 * rather than the form itself.
 *
 * The spinner used to be local: a `Loader2` plus a keyframes block in
 * `SubmitButton.module.css`, one more of the independent spinners haus#55
 * consolidated on the haus side. haus `Button`'s `loading` owns all of it now:
 * the Spinner, the `disabled`, and the `aria-busy` that announces it. What stays
 * local is `pendingLabel`, which is copy rather than behaviour and which haus
 * `Button` has no opinion on.
 */
export function SubmitButton({
  children,
  /** Shown in place of the label while the action is in flight. */
  pendingLabel,
  disabled,
  ...rest
}: ButtonOwnProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button {...rest} type="submit" loading={pending} disabled={disabled}>
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
