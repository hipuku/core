import type { DecisionStatus, Role } from "./types";

/**
 * Persistence port for the decision domain. The service depends on this interface,
 * not on Drizzle, so its orchestration — which spans the versioning engine, the
 * lifecycle rules and several tables — is exercised in-memory by the tests and
 * backed by Postgres in production. The two writes that must not tear (a status
 * change and its transition row; a decision and its first transition) are single
 * methods here so the Drizzle implementation can wrap each in one transaction.
 */
export interface WorkspaceRecord {
  id: string;
  name: string;
  key: string;
  ownerId: string;
  createdAt: Date;
}

export interface MembershipRecord {
  workspaceId: string;
  userId: string;
  role: Role;
  createdAt: Date;
}

export interface DecisionRecord {
  id: string;
  workspaceId: string;
  number: number;
  title: string;
  status: DecisionStatus;
  authorId: string;
  documentId: string;
  supersededById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransitionRecord {
  id: string;
  decisionId: string;
  fromStatus: DecisionStatus | null;
  toStatus: DecisionStatus;
  actorId: string;
  reason: string | null;
  createdAt: Date;
}

export interface RepoRecord {
  id: string;
  workspaceId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  connectedBy: string;
  createdAt: Date;
}

export type ReferenceKind = "link" | "file";

export interface ReferenceRecord {
  id: string;
  decisionId: string;
  kind: ReferenceKind;
  label: string | null;
  url: string | null;
  repo: string | null;
  path: string | null;
  /** A cited line span, 1-based inclusive. Null means the whole file. */
  startLine: number | null;
  endLine: number | null;
  /** The cited lines as they read when cited — lets a moved block be told from a changed one. */
  baselineSnippet: string | null;
  baselineSha: string | null;
  currentSha: string | null;
  checkedAt: Date | null;
  addedBy: string;
  createdAt: Date;
}

/**
 * An unsent decision, parked by its author. Not a lifecycle state — see the
 * `decision_drafts` table comment for why this is kept out of `decisions`.
 */
export interface DraftRecord {
  id: string;
  workspaceId: string;
  authorId: string;
  title: string;
  /** Every block may be empty — a draft is under no obligation to be complete. */
  body: { context: string; decision: string; consequences: string };
  refs: { repoId: string; repo: string; path: string; lines: string | null }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DecisionStore {
  createWorkspace(input: {
    id: string;
    name: string;
    key: string;
    ownerId: string;
    createdAt: Date;
  }): Promise<WorkspaceRecord>;
  addMember(input: MembershipRecord): Promise<MembershipRecord>;
  getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null>;
  listMembers(workspaceId: string): Promise<MembershipRecord[]>;
  removeMember(workspaceId: string, userId: string): Promise<void>;

  /**
   * Insert a decision and its opening transition atomically, assigning the next
   * per-workspace ADR number. The caller supplies everything but the number.
   */
  insertDecision(input: {
    decision: Omit<DecisionRecord, "number">;
    transition: TransitionRecord;
  }): Promise<DecisionRecord>;

  getWorkspace(id: string): Promise<WorkspaceRecord | null>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceRecord[]>;

  /**
   * The number the next decision in this workspace would take. A *preview* for
   * the compose screen, not a reservation — nothing is held, and two authors
   * composing at once will both see the same number. The real number is assigned
   * inside `insertDecision`'s transaction, where the unique constraint settles
   * any race. Kept read-only on purpose: reserving a number for an unsent draft
   * would leave permanent gaps in the ADR sequence.
   */
  peekNextNumber(workspaceId: string): Promise<number>;

  getDecision(id: string): Promise<DecisionRecord | null>;
  listDecisions(workspaceId: string): Promise<DecisionRecord[]>;
  countDecisions(workspaceId: string): Promise<number>;
  countProposed(workspaceId: string): Promise<number>;
  updateWorkspace(id: string, patch: { name: string; key: string }): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;

  /** Change a decision's status and append its transition atomically. */
  applyStatusChange(input: {
    decisionId: string;
    toStatus: DecisionStatus;
    supersededById?: string | null;
    updatedAt: Date;
    transition: TransitionRecord;
  }): Promise<void>;

  listTransitions(decisionId: string): Promise<TransitionRecord[]>;

  addReference(reference: ReferenceRecord): Promise<void>;
  getReference(id: string): Promise<ReferenceRecord | null>;
  listReferences(decisionId: string): Promise<ReferenceRecord[]>;
  deleteReference(id: string): Promise<void>;
  /**
   * Move a file reference's baseline to the state it is in now. Used when a
   * decision is accepted — the reference point is the code the team agreed to,
   * not the code the author happened to be looking at while drafting.
   */
  rebaselineReference(
    id: string,
    state: {
      baselineSha: string | null;
      baselineSnippet: string | null;
      startLine: number | null;
      endLine: number | null;
      checkedAt: Date;
    },
  ): Promise<void>;

  updateReferenceState(
    id: string,
    state: {
      currentSha: string | null;
      checkedAt: Date;
      /** Set when a cited block was found to have moved, so the range follows it. */
      startLine?: number;
      endLine?: number;
    },
  ): Promise<void>;

  upsertDraft(draft: DraftRecord): Promise<DraftRecord>;
  getDraft(id: string): Promise<DraftRecord | null>;
  /** An author's own drafts in one workspace, newest first. */
  listDrafts(workspaceId: string, authorId: string): Promise<DraftRecord[]>;
  deleteDraft(id: string): Promise<void>;
  /** Discard an author's drafts last touched before `before`. Returns how many. */
  deleteDraftsBefore(authorId: string, before: Date): Promise<number>;

  addWorkspaceRepo(repo: RepoRecord): Promise<void>;
  listWorkspaceRepos(workspaceId: string): Promise<RepoRecord[]>;
  getWorkspaceRepo(id: string): Promise<RepoRecord | null>;
  deleteWorkspaceRepo(id: string): Promise<void>;
}
