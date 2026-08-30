"use client";

import { createContext, useContext } from "react";

/**
 * What the editor knows about citations, offered to whatever renders the
 * reference list.
 *
 * The editor owns the textarea, the caret and the prose; the reference list is
 * passed in from a server component, which cannot hand callbacks across that
 * boundary. Context solves it without either side knowing about the other: the
 * element is created on the server, but it *renders* inside the editor's tree,
 * so the provider reaches it.
 */
export interface Citable {
  repo: string;
  path: string;
  lines: string | null;
}

export interface EditorCitations {
  /** Drop a citation into the document at the caret. */
  insert: (citable: Citable) => void;
  /** Files named in the prose that no reference covers yet. */
  untracked: (Citable & { repoId: string })[];
}

const Context = createContext<EditorCitations | null>(null);

export const CitationInsertProvider = Context.Provider;

/** Null where there is no editor above, which is a read-only view. */
export function useEditorCitations(): EditorCitations | null {
  return useContext(Context);
}
