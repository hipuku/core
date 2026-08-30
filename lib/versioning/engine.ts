import { randomUUID } from "node:crypto";
import { diff } from "./diff";
import type { Change, DocumentRecord, Json, Version } from "./types";

/**
 * The persistence port. The engine depends on this interface, never on Drizzle or
 * Postgres directly, so its whole surface is exercised in-memory by the tests and
 * backed by the database in production. Same contract, two implementations.
 */
export interface VersionStore {
  createDocument(input: {
    ownerId: string;
    name: string;
  }): Promise<DocumentRecord>;
  getDocument(id: string): Promise<DocumentRecord | null>;
  setHead(documentId: string, versionId: string): Promise<void>;
  appendVersion(version: Version): Promise<void>;
  getVersion(id: string): Promise<Version | null>;
  /** Oldest first. Linear history, so index order is also parent order. */
  listVersions(documentId: string): Promise<Version[]>;
}

export interface Clock {
  now(): Date;
}
export interface IdGenerator {
  next(): string;
}

const systemClock: Clock = { now: () => new Date() };
const uuidGenerator: IdGenerator = { next: () => randomUUID() };

export class VersioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersioningError";
  }
}

/** A version annotated with its diff from the preceding version. */
export type HistoryEntry = Version & { changes: Change[] };

export class Versioning {
  constructor(
    private readonly store: VersionStore,
    private readonly clock: Clock = systemClock,
    private readonly ids: IdGenerator = uuidGenerator,
  ) {}

  /** Create a document and seed it with an initial commit. */
  async create(
    ownerId: string,
    name: string,
    initialState: Json = {},
  ): Promise<{ document: DocumentRecord; version: Version }> {
    const created = await this.store.createDocument({ ownerId, name });
    const version = await this.commit(
      created.id,
      initialState,
      ownerId,
      "Created",
    );
    return { document: await this.requireDocument(created.id), version };
  }

  /** Append a new immutable snapshot and advance the document head to it. */
  async commit(
    documentId: string,
    state: Json,
    authorId: string,
    message: string,
  ): Promise<Version> {
    const document = await this.requireDocument(documentId);
    const version: Version = {
      id: this.ids.next(),
      documentId,
      parentId: document.headVersionId,
      authorId,
      message,
      createdAt: this.clock.now(),
      state,
    };
    await this.store.appendVersion(version);
    await this.store.setHead(documentId, version.id);
    return version;
  }

  /**
   * Restore is a forward action, not a rewind: it writes a NEW commit whose state
   * equals the target version's. History stays append-only and auditable, so you can
   * always see that a restore happened, and restore the restore. This is git revert,
   * not git reset, and it is the only choice that survives multiple users editing the
   * same document without one silently erasing another's history.
   */
  async restore(
    documentId: string,
    versionId: string,
    authorId: string,
  ): Promise<Version> {
    const target = await this.store.getVersion(versionId);
    if (!target || target.documentId !== documentId) {
      throw new VersioningError("version does not belong to this document");
    }
    return this.commit(
      documentId,
      target.state,
      authorId,
      `Restored version ${shortId(versionId)}`,
    );
  }

  /** The structural diff between any two versions of the same document. */
  async diffVersions(fromId: string, toId: string): Promise<Change[]> {
    const [from, to] = await Promise.all([
      this.store.getVersion(fromId),
      this.store.getVersion(toId),
    ]);
    if (!from || !to) throw new VersioningError("version not found");
    if (from.documentId !== to.documentId) {
      throw new VersioningError("versions belong to different documents");
    }
    return diff(from.state, to.state);
  }

  /** Full history, oldest first, each entry carrying its diff from the previous one. */
  async history(documentId: string): Promise<HistoryEntry[]> {
    await this.requireDocument(documentId);
    const versions = await this.store.listVersions(documentId);
    let previous: Json = {};
    return versions.map((version) => {
      const entry: HistoryEntry = {
        ...version,
        changes: diff(previous, version.state),
      };
      previous = version.state;
      return entry;
    });
  }

  private async requireDocument(id: string): Promise<DocumentRecord> {
    const document = await this.store.getDocument(id);
    if (!document) throw new VersioningError("document not found");
    return document;
  }
}

function shortId(id: string): string {
  return id.slice(0, 8);
}
