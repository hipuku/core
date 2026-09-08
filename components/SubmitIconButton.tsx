"use client";

import { useFormStatus } from "react-dom";
import { IconButton, type IconButtonProps } from "haus-components";

/**
 * The icon-sized sibling of `SubmitButton`, composing haus `IconButton`.
 *
 * It began as a product-local component because haus had no icon-button
 * counterpart. That was the gap C3 measured, `haus#58` promoted it on the
 * evidence, and this is now a four-line adapter over the real thing: all it
 * adds is `useFormStatus`, which has to be read by a child of the form rather
 * than by the form itself.
 */
export function SubmitIconButton({
  disabled,
  ...rest
}: Omit<IconButtonProps, "type" | "loading">) {
  const { pending } = useFormStatus();
  return <IconButton {...rest} loading={pending} disabled={disabled} />;
}
