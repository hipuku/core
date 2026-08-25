"use client";

import { createContext, useContext } from "react";

/**
 * Lets a reference list drop a citation into the document it belongs to.
 *
 * The editor owns the textarea and the caret; the reference list is passed in
 * from a server component, which cannot hand a callback across that boundary.
 * Context solves it without either side knowing about the other: the element is
 * created on the server, but it *renders* inside the editor's tree, so the
 * provider reaches it.
 */
export interface Citable {
  repo: string;
  path: string;
  lines: string | null;
}

const CitationInsertContext = createContext<((citable: Citable) => void) | null>(null);

export const CitationInsertProvider = CitationInsertContext.Provider;

/** The insert function, or null where there is no editor above — read-only views. */
export function useCitationInsert(): ((citable: Citable) => void) | null {
  return useContext(CitationInsertContext);
}
