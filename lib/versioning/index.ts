import { Versioning } from "./engine";
import { DrizzleVersionStore } from "./drizzle-store";

export * from "./types";

/** The application's versioning service, backed by Postgres. */
export const versioning = new Versioning(new DrizzleVersionStore());
