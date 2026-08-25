import { versioning } from "@/lib/versioning";
import { DecisionService } from "./service";
import { DrizzleDecisionStore } from "./drizzle-store";

export * from "./types";
export * from "./lifecycle";
export { referenceDrift, isStale, type DriftStatus } from "./drift";
export {
  supersessionChain,
  type Lineal,
  type LineageEntry,
} from "./lineage";
export {
  compareSnippet,
  extractRange,
  formatRange,
  parseRange,
  type LineRange,
} from "./snippet";
export { decisionLabel, deriveWorkspaceKey } from "./key";
export type {
  DecisionRecord,
  DecisionStore,
  DraftRecord,
  MembershipRecord,
  ReferenceKind,
  ReferenceRecord,
  RepoRecord,
  TransitionRecord,
  WorkspaceRecord,
} from "./store";
export { DecisionError, DecisionService } from "./service";
export { MemoryDecisionStore } from "./memory-store";
export { DrizzleDecisionStore } from "./drizzle-store";

/** The application's decision service, backed by Postgres. */
export const decisionService = new DecisionService(
  new DrizzleDecisionStore(),
  versioning,
);
