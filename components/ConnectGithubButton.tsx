"use client";

import { Button, type ButtonProps } from "haus-components";
import { authClient } from "@/lib/auth-client";
import { GithubMark } from "@/components/icons/GithubMark";

export function ConnectGithubButton({
  label = "Connect GitHub",
  ...rest
}: ButtonProps & { label?: string }) {
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
