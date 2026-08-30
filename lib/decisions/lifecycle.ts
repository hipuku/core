import type {
  Actor,
  Capability,
  DecisionStatus,
  Guard,
  Role,
  TransitionRule,
} from "./types";

/**
 * The whole state machine as data. Every legal move and the capability it demands
 * lives here; nothing transitions a decision except by matching a row in this table.
 *
 *   proposed ──accept──▶ accepted ──deprecate──▶ deprecated
 *      │                    │
 *    reject             supersede
 *      ▼                    ▼
 *   rejected            superseded
 *
 * `rejected`, `deprecated` and `superseded` are terminal: no row starts from them.
 */
export const TRANSITIONS: readonly TransitionRule[] = [
  { from: "proposed", to: "accepted", capability: "accept" },
  { from: "proposed", to: "rejected", capability: "reject" },
  { from: "accepted", to: "deprecated", capability: "deprecate" },
  { from: "accepted", to: "superseded", capability: "supersede" },
];

/** Named capability bundles. Roles are a convenience over the capability set. */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  author: ["propose", "edit"],
  maintainer: ["propose", "edit", "accept", "reject", "deprecate", "supersede"],
};

export function capabilitiesFor(role: Role): Capability[] {
  return ROLE_CAPABILITIES[role];
}

/** Every status reachable from `from` in one legal move. */
export function allowedTransitions(from: DecisionStatus): TransitionRule[] {
  return TRANSITIONS.filter((rule) => rule.from === from);
}

/** A status with no outgoing transitions: the decision has reached a final resting state. */
export function isTerminal(status: DecisionStatus): boolean {
  return allowedTransitions(status).length === 0;
}

/**
 * Can this actor move a decision from `from` to `to`? Refuses with a reason when the
 * edge does not exist or the actor lacks the capability it requires.
 */
export function checkTransition(
  from: DecisionStatus,
  to: DecisionStatus,
  actor: Actor,
): Guard {
  const rule = TRANSITIONS.find((r) => r.from === from && r.to === to);
  if (!rule) {
    return { ok: false, reason: `no transition from ${from} to ${to}` };
  }
  if (!actor.capabilities.includes(rule.capability)) {
    return { ok: false, reason: `requires the ${rule.capability} capability` };
  }
  return { ok: true };
}

/**
 * An accepted decision is immutable, which is the ADR discipline. To change a decision you
 * supersede it with a new one, so the record of what was decided, and when, is never
 * quietly rewritten. Content is therefore editable only while `proposed`, and only by
 * its author or an actor holding the `edit` capability.
 */
export function canEditContent(
  status: DecisionStatus,
  actor: Actor,
  isAuthor: boolean,
): Guard {
  if (status !== "proposed") {
    return {
      ok: false,
      reason: "a decision is immutable once it leaves 'proposed'; supersede it instead",
    };
  }
  if (isAuthor || actor.capabilities.includes("edit")) {
    return { ok: true };
  }
  return { ok: false, reason: "only the author or an editor may revise a proposal" };
}

/**
 * Supersession is the ADR way of changing your mind: a new, accepted decision
 * replaces an older accepted one, and the older moves to `superseded` with a link
 * back from its replacement. Both must be accepted, a decision cannot supersede
 * itself, and the actor needs the `supersede` capability.
 */
export function checkSupersede(params: {
  superseding: { id: string; status: DecisionStatus };
  superseded: { id: string; status: DecisionStatus };
  actor: Actor;
}): Guard {
  const { superseding, superseded, actor } = params;
  if (superseding.id === superseded.id) {
    return { ok: false, reason: "a decision cannot supersede itself" };
  }
  if (superseding.status !== "accepted") {
    return { ok: false, reason: "the superseding decision must be accepted first" };
  }
  if (superseded.status !== "accepted") {
    return { ok: false, reason: "only an accepted decision can be superseded" };
  }
  if (!actor.capabilities.includes("supersede")) {
    return { ok: false, reason: "requires the supersede capability" };
  }
  return { ok: true };
}
