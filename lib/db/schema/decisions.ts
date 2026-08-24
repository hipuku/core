import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { documents } from "./versioning";

export const decisionStatus = pgEnum("decision_status", [
  "proposed",
  "accepted",
  "rejected",
  "deprecated",
  "superseded",
]);

export const memberRole = pgEnum("member_role", ["author", "maintainer"]);

export const referenceKind = pgEnum("reference_kind", ["link", "file"]);

/** A team. Decisions, membership and ADR numbering are all scoped to a workspace. */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Who belongs to a workspace, and the role that resolves to their capabilities. */
export const memberships = pgTable(
  "memberships",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("author"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

/**
 * A decision record. Its editable body lives in a versioning `document` (referenced
 * by `documentId`); the columns here carry the lifecycle axis instead. `number` is
 * the per-workspace ADR number. `supersededById` points at the decision that
 * replaced this one — present only once this decision is superseded — which makes
 * "superseded by" a column read and "supersedes" its inverse query.
 */
export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    status: decisionStatus("status").notNull().default("proposed"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    supersededById: uuid("superseded_by_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  // ADR numbers are unique per workspace. If two proposals race for the same number,
  // one insert loses on this constraint and retries — the integrity guarantee the
  // application-level max()+1 cannot make on its own.
  (table) => [unique("decisions_workspace_number_key").on(table.workspaceId, table.number)],
);

/**
 * The append-only status audit trail — the decision's own history, distinct from the
 * content history the versioning engine keeps. Every proposal, acceptance, rejection
 * and supersession lands one immutable row here. `fromStatus` is null for the
 * decision's creation.
 */
/**
 * A GitHub repo connected to a workspace, so its files can be referenced by
 * decisions. Only the connection is stored; file browsing uses the *current*
 * user's GitHub token, so no one borrows another user's access.
 */
export const workspaceRepos = pgTable(
  "workspace_repos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    connectedBy: text("connected_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("workspace_repos_key").on(table.workspaceId, table.owner, table.name),
  ],
);

/**
 * Evidence attached to a decision. `link` references are a labelled URL. `file`
 * references point at a specific file in a connected repo (repo + path) and are
 * created from the GitHub picker — the columns exist now so both kinds share one
 * table. Not versioned: references augment a decision, they are not its prose.
 */
export const decisionReferences = pgTable("decision_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id, { onDelete: "cascade" }),
  kind: referenceKind("kind").notNull(),
  label: text("label"),
  url: text("url"),
  repo: text("repo"),
  path: text("path"),
  // Staleness: the file's git blob SHA when it was cited (baseline), the latest
  // SHA observed on a drift check (null = the file is gone), and when that was.
  baselineSha: text("baseline_sha"),
  currentSha: text("current_sha"),
  checkedAt: timestamp("checked_at"),
  addedBy: text("added_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const decisionTransitions = pgTable("decision_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id, { onDelete: "cascade" }),
  fromStatus: decisionStatus("from_status"),
  toStatus: decisionStatus("to_status").notNull(),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
