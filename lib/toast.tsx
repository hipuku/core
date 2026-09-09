"use client";

import { toast as sonner } from "sonner";
import { Toast } from "haus-components";

/**
 * haus's Toast surface, inside sonner's queue.
 *
 * This is decision 0008's split, taken literally. haus ships a Toast surface
 * and deliberately no provider, no queue, no positioning, no auto-dismiss and
 * no stacking, on the reasoning that a toast system is an application concern
 * and a design system that ships one is shipping an opinion most consumers
 * fight. Measured across the portfolio, **core is the only product with toasts
 * at all**, so a haus provider would have exactly one consumer and would fail
 * decision 0013 on evidence.
 *
 * So sonner keeps the hard half and haus draws the surface. `toast.custom`
 * renders arbitrary JSX **without** sonner's own surface, which is the seam
 * that makes the split possible rather than a compromise: there is no sonner
 * card underneath with a haus card on top of it.
 *
 * Same shape as the API it replaces, so a call site changes its import and
 * nothing else. That is the point: eleven call sites, one line each.
 */

/** sonner hands the render function the id it assigned, which is what dismisses it. */
const surface = (tone: "success" | "error", title: string) => {
  const Surface = (id: number | string) => (
    <Toast tone={tone} title={title} onClose={() => sonner.dismiss(id)} />
  );
  Surface.displayName = "ToastSurface";
  return Surface;
};

export const toast = {
  success: (title: string) => sonner.custom(surface("success", title)),
  error: (title: string) => sonner.custom(surface("error", title)),
  /** Escape hatch, for anything reaching past the two tones core actually uses. */
  raw: sonner,
};
