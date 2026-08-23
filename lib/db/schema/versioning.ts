import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * A document is a named, owned container. `headVersionId` points at the latest
 * version but is intentionally NOT a foreign key: documents and versions reference
 * each other, and a hard FK both ways is a circular-dependency migration headache
 * for no integrity gain the application layer does not already guarantee.
 */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  headVersionId: uuid("head_version_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * An immutable snapshot of a document's full state. Append-only: rows are never
 * updated or deleted in normal operation, which is what lets restore be a forward
 * commit and history be trustworthy.
 */
export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    message: text("message").notNull(),
    state: jsonb("state").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("document_versions_document_id_idx").on(table.documentId)],
);
