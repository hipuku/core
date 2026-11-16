import { versioning } from "@/lib/versioning";
import { DecisionService } from "./service";
import { DrizzleDecisionStore } from "./drizzle-store";

export * from "./types";
export * from "./lifecycle";
export { isStale } from "./drift";
export { supersessionChain } from "./lineage";
export { compareSnippet, extractRange, formatRange, parseRange, type LineRange } from "./snippet";
export { decisionLabel } from "./key";
export { adrBody, citedRefs, referenceLabel } from "./form";
export { DecisionError } from "./service";

/** The application's decision service, backed by Postgres. */
export const decisionService = new DecisionService(new DrizzleDecisionStore(), versioning);
