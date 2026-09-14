/**
 * The draft the demo workspace is seeded with, and its nightly restore.
 *
 * On the public deployment every visitor signs in as the demo account, so its
 * drafts are shared with every later visitor. The prune cron deletes the ones
 * not updated in 24 hours, which would include this one, and a visitor may
 * also discard it. `restoreSeededDraft` runs after the prune and puts it back
 * when no draft with its title is left.
 */

import type { DecisionService } from "./service";

/** The workspace `npm run db:seed` builds, and the one the restore looks in. */
export const DEMO_WORKSPACE_NAME = "haus";

export const SEEDED_DRAFT = {
  title: "Reopen polarity, so dark mode can exist",
  body: {
    context:
      "Surface polarity is fixed by the contract: white cards on a subtle " +
      "page, and not a brand-map axis. Every surface role is paired with the " +
      "ink that is safe on it, and that pairing is what makes contrast " +
      "decidable once at the token layer.\n\n" +
      "The consequence nobody wrote down until recently is that **a dark " +
      "theme cannot arrive as a brand map**, because it is a polarity " +
      "inversion. It is the first thing anyone asks a design system.",
    decision:
      "Still deciding. Three shapes, none costed:\n\n" +
      "- [ ] Leave it. Say plainly that dark mode is out of scope and why\n" +
      "- [ ] Make polarity an axis, and pair ink per polarity. This doubles the " +
      "colour decision surface\n" +
      "- [ ] A second contract rather than a second brand, so the pairing " +
      "guarantee survives\n\n" +
      "The third is the only one that keeps the promise the roles make. It " +
      "is also the most work, and it is not obvious it should happen before " +
      "a consumer asks for it.",
    consequences: "",
  },
  refs: [],
};

/**
 * Save the seeded draft for `authorId` in the demo workspace if no draft with
 * its title exists there. Returns whether it saved one. Returns false when the
 * author belongs to no workspace of that name.
 */
export async function restoreSeededDraft(
  service: Pick<DecisionService, "listWorkspaces" | "listDrafts" | "saveDraft">,
  authorId: string,
): Promise<boolean> {
  const workspaces = await service.listWorkspaces(authorId);
  const workspace = workspaces.find((w) => w.name === DEMO_WORKSPACE_NAME);
  if (!workspace) return false;

  const drafts = await service.listDrafts(workspace.id, authorId);
  if (drafts.some((d) => d.title === SEEDED_DRAFT.title)) return false;

  await service.saveDraft(workspace.id, authorId, SEEDED_DRAFT);
  return true;
}
