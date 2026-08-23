import { Versioning } from "./engine";
import { DrizzleVersionStore } from "./drizzle-store";

export * from "./types";
export { Versioning, VersioningError, type HistoryEntry } from "./engine";
export type { VersionStore } from "./engine";
export { MemoryVersionStore } from "./memory-store";
export { DrizzleVersionStore } from "./drizzle-store";
export { diff, equal } from "./diff";

/** The application's versioning service, backed by Postgres. */
export const versioning = new Versioning(new DrizzleVersionStore());
