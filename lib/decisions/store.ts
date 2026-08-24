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
  baselineSha: string | null;
  currentSha: string | null;
  checkedAt: Date | null;
  addedBy: string;
  createdAt: Date;
}

export interface DecisionStore {
  createWorkspace(input: {
    id: string;
    name: string;
    ownerId: string;
    createdAt: Date;
  }): Promise<WorkspaceRecord>;
  addMember(input: MembershipRecord): Promise<MembershipRecord>;
  getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null>;
  listMembers(workspaceId: string): Promise<MembershipRecord[]>;

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

  getDecision(id: string): Promise<DecisionRecord | null>;
  listDecisions(workspaceId: string): Promise<DecisionRecord[]>;
  countDecisions(workspaceId: string): Promise<number>;
  renameWorkspace(id: string, name: string): Promise<void>;
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
  updateReferenceState(
    id: string,
    state: { currentSha: string | null; checkedAt: Date },
  ): Promise<void>;

  addWorkspaceRepo(repo: RepoRecord): Promise<void>;
  listWorkspaceRepos(workspaceId: string): Promise<RepoRecord[]>;
  getWorkspaceRepo(id: string): Promise<RepoRecord | null>;
  deleteWorkspaceRepo(id: string): Promise<void>;
}
