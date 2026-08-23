"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        // Call through authClient so the method keeps its binding — a bare
        // destructured signOut() loses `this` and silently no-ops.
        await authClient.signOut();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
