"use client";

import { authClient } from "@/lib/auth-client";

export function ConnectGithubButton({
  className = "btn",
  label = "Connect GitHub",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        authClient.linkSocial({
          provider: "github",
          callbackURL: window.location.href,
        })
      }
    >
      {label}
    </button>
  );
}
