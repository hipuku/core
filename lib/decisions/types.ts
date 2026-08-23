/**
 * The decision lifecycle. A decision record (an ADR) moves through a small,
 * explicit state machine; this module owns the rules for that movement and knows
 * nothing about storage or UI. The ADR's editable *content* is versioned separately
 * by lib/versioning — this file governs the orthogonal question of a decision's
 * *status* over time.
 */
export type DecisionStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "deprecated"
  | "superseded";

/**
 * Capabilities, not roles, gate every action. Roles are just named bundles of
 * these (see ROLE_CAPABILITIES), which keeps the state machine's guards readable and
 * lets the role model change without touching a single transition rule.
 */
export type Capability =
  | "propose"
  | "edit"
  | "accept"
  | "reject"
  | "deprecate"
  | "supersede";

export type Role = "author" | "maintainer";

export interface Actor {
  id: string;
  capabilities: Capability[];
}

/** A permission-gated edge in the state machine. */
export interface TransitionRule {
  from: DecisionStatus;
  to: DecisionStatus;
  capability: Capability;
}

/** The result of a guarded check: either allowed, or refused with a human reason. */
export type Guard = { ok: true } | { ok: false; reason: string };
