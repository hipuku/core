/**
 * A short project key for a workspace, à la Jira (VAULT → decisions VAU-001).
 * Multi-word names become initials ("Platform team" → "PT"); a single word takes
 * its first letters ("Vault" → "VAU"). Editable later in settings.
 */
export function deriveWorkspaceKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let key =
    words.length >= 2
      ? words.slice(0, 4).map((w) => w[0]).join("")
      : (words[0] ?? "").slice(0, 3);
  key = key.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (key.length < 2) {
    key = `${(name.replace(/[^a-zA-Z0-9]/g, "") || "WS").toUpperCase()}XX`.slice(0, 3);
  }
  return key;
}

/** Coerce user-typed key input into a valid key (uppercase alphanumeric, 2–6). */
export function normalizeWorkspaceKey(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  return cleaned.length >= 2 ? cleaned : "WS";
}

/** The display label for a decision, e.g. "VAU-014". */
export function decisionLabel(key: string, number: number): string {
  return `${key}-${String(number).padStart(3, "0")}`;
}
