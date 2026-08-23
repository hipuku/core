import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, documentVersions } from "@/lib/db/schema";
import type { VersionStore } from "./engine";
import type { DocumentRecord, Json, Version } from "./types";

/**
 * The production VersionStore, backed by Postgres through Drizzle. It implements the
 * exact interface the in-memory store does and the tests pin, so swapping it in
 * changes where the data lives and nothing about how versioning behaves.
 */
export class DrizzleVersionStore implements VersionStore {
  async createDocument(input: {
    ownerId: string;
    name: string;
  }): Promise<DocumentRecord> {
    const [row] = await db
      .insert(documents)
      .values({ ownerId: input.ownerId, name: input.name })
      .returning();
    return toDocument(row);
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    const [row] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return row ? toDocument(row) : null;
  }

  async setHead(documentId: string, versionId: string): Promise<void> {
    await db
      .update(documents)
      .set({ headVersionId: versionId, updatedAt: new Date() })
      .where(eq(documents.id, documentId));
  }

  async appendVersion(version: Version): Promise<void> {
    await db.insert(documentVersions).values({
      id: version.id,
      documentId: version.documentId,
      parentId: version.parentId,
      authorId: version.authorId,
      message: version.message,
      state: version.state,
      createdAt: version.createdAt,
    });
  }

  async getVersion(id: string): Promise<Version | null> {
    const [row] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, id))
      .limit(1);
    return row ? toVersion(row) : null;
  }

  async listVersions(documentId: string): Promise<Version[]> {
    const rows = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(asc(documentVersions.createdAt));
    return rows.map(toVersion);
  }
}

type DocumentRow = typeof documents.$inferSelect;
type VersionRow = typeof documentVersions.$inferSelect;

function toDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    headVersionId: row.headVersionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVersion(row: VersionRow): Version {
  return {
    id: row.id,
    documentId: row.documentId,
    parentId: row.parentId,
    authorId: row.authorId,
    message: row.message,
    createdAt: row.createdAt,
    state: row.state as Json,
  };
}
