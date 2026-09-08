"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "haus-components";

/**
 * The icon-sized sibling of `SubmitButton`, and product-local on purpose. C3.
 *
 * haus has no icon-button counterpart. Its component set is Avatar, Badge,
 * Button, Callout, Card, Checkbox, Divider, EmptyState, Input, Modal, Popover,
 * Radio, Select, Spinner, Tabs, Textarea, Toast, Toggle, Tooltip, so core's
 * `.iconbtn` stays, and this stays with it. Recorded for `C4` rather than
 * migrated.
 *
 * What it does take from haus is the `Spinner`, so the busy state is the same
 * one `Button`'s `loading` renders rather than another local keyframes block.
 * The `aria-busy` that Button sets for free has to be set by hand here.
 */
export function SubmitIconButton({
  children,
  className,
  disabled,
  ...rest
}: React.ComponentProps<"button">) {
  const { pending } = useFormStatus();

  return (
    <button
      {...rest}
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
    >
      {pending ? <Spinner size="text" announcedBy="the button's aria-busy state" /> : children}
    </button>
  );
}
