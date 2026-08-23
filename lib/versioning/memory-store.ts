import type { VersionStore } from "./engine";
import type { DocumentRecord, Version } from "./types";

/**
 * A fully in-memory VersionStore. It is the test double for the engine, and doubles
 * as the backing store for demos and local prototyping before a database is wired.
 * Because it satisfies the exact same interface as the Drizzle store, a green test
 * suite here is a real statement about the engine's behaviour, not a mock's.
 */
export class MemoryVersionStore implements VersionStore {
  private documents = new Map<string, DocumentRecord>();
  private versions = new Map<string, Version>();
  private idSeq = 0;

  async createDocument(input: {
    ownerId: string;
    name: string;
  }): Promise<DocumentRecord> {
    const now = new Date();
    const document: DocumentRecord = {
      id: `doc_${++this.idSeq}`,
      ownerId: input.ownerId,
      name: input.name,
      headVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(document.id, { ...document });
    return { ...document };
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    const document = this.documents.get(id);
    return document ? { ...document } : null;
  }

  async setHead(documentId: string, versionId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) throw new Error("document not found");
    document.headVersionId = versionId;
    document.updatedAt = new Date();
  }

  async appendVersion(version: Version): Promise<void> {
    this.versions.set(version.id, { ...version });
  }

  async getVersion(id: string): Promise<Version | null> {
    const version = this.versions.get(id);
    return version ? { ...version } : null;
  }

  async listVersions(documentId: string): Promise<Version[]> {
    return [...this.versions.values()]
      .filter((version) => version.documentId === documentId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((version) => ({ ...version }));
  }
}
