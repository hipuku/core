import { Badge, type BadgeTone } from "haus-components";
import type { DecisionStatus } from "@/lib/decisions";

/**
 * A decision's state, drawn as a haus `Badge`.
 *
 * `C1` recorded the decision states as product-local, on the reasoning that
 * they are a domain vocabulary haus has no opinion on, and core kept `.pill`
 * with six `--st-*` tokens behind it. **haus decision 0021 supersedes that**,
 * and the reason `C1` was wrong is worth keeping: it counted six states against
 * five tones and concluded haus could not carry them. `BadgeTone` and
 * `BadgeAppearance` are two axes, so the real number of slots is twelve. The
 * constraint was measured on one axis of a two-axis component.
 */

/**
 * The whole mapping, in one place, so a seventh state cannot be added without
 * meeting this table.
 *
 * `superseded` is the only judgement call. It is not a failure, which is
 * `rejected` and takes `error`; and it is not inactive, which is `draft` and
 * takes `neutral`. It is *replaced, and still historically valid*, so it takes a
 * slot that is distinct without being alarming.
 */
const TONE: Record<DecisionStatus | "draft", BadgeTone> = {
  draft: "neutral",
  proposed: "info",
  accepted: "success",
  rejected: "error",
  deprecated: "warning",
  superseded: "primary",
};

/**
 * The text a screen reader actually reads.
 *
 * Both `.pill` and haus `Badge` uppercase in CSS, so this changes nothing on
 * screen. It changes what is in the DOM, which is the only version assistive
 * technology and the tests ever see, and a capitalised word is better than a
 * raw enum value there. `.pill` already did this for drafts and not for the
 * five statuses, which is why "Draft" was capitalised and "accepted" was not.
 */
const LABEL: Record<DecisionStatus | "draft", string> = {
  draft: "Draft",
  proposed: "Proposed",
  accepted: "Accepted",
  rejected: "Rejected",
  deprecated: "Deprecated",
  superseded: "Superseded",
};

export function StatusBadge({
  status,
}: {
  status: DecisionStatus | "draft";
}) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
