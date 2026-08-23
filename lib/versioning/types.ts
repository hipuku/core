/**
 * The versioning core is deliberately domain-agnostic. It knows how to snapshot,
 * diff and restore arbitrary JSON state, and nothing about what that state means.
 * Whatever core turns out to be, the entity it versions is a `Json` blob here.
 */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

/** A named, owned container whose state moves forward one immutable version at a time. */
export interface DocumentRecord {
  id: string;
  ownerId: string;
  name: string;
  /** The latest version, or null before the first commit. */
  headVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** An immutable snapshot of a document's full state. History is append-only. */
export interface Version {
  id: string;
  documentId: string;
  /** The version this one was built on. null only for the very first commit. */
  parentId: string | null;
  authorId: string;
  message: string;
  createdAt: Date;
  state: Json;
}

export type ChangeOp = "add" | "remove" | "replace";

/** One structural difference between two states, located by an RFC 6901 JSON Pointer. */
export interface Change {
  op: ChangeOp;
  path: string;
  before?: Json;
  after?: Json;
}
