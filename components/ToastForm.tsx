"use client";

import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/**
 * A form whose server action returns an ActionResult; success and error both
 * surface as a toast instead of a full-page error. Use for mutations that stay
 * on the page (revalidate), not ones that redirect.
 */
export function ToastForm({
  action,
  children,
  className,
  style,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <form
      className={className}
      style={style}
      action={async (formData) => {
        const result = await action(formData);
        if (result?.error) toast.error(result.error);
        else if (result?.ok) toast.success(result.ok);
      }}
    >
      {children}
    </form>
  );
}
