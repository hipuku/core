"use client";

import { Button, type ButtonProps } from "haus-components";

/**
 * The half of haus `ButtonProps` that renders a real button.
 *
 * `ButtonProps` became a union with `asChild` (haus#57), and the `asChild` half
 * requires exactly one child element. A wrapper that accepts the whole union and
 * renders an icon beside a label is checked against that half and rejected, even
 * though it never passes `asChild`. Narrowing to the non-`asChild` half is what a
 * wrapper actually means. haus#66.
 */
type ButtonOwnProps = Extract<ButtonProps, { asChild?: false }>;
import { authClient } from "@/lib/auth-client";
import { GithubMark } from "@/components/icons/GithubMark";

export function ConnectGithubButton({
  label = "Connect GitHub",
  ...rest
}: ButtonOwnProps & { label?: string }) {
  return (
    <Button
      {...rest}
      type="button"
      onClick={() =>
        authClient.linkSocial({
          provider: "github",
          callbackURL: window.location.href,
        })
      }
    >
      <GithubMark />
      {label}
    </Button>
  );
}
