/**
 * "just now" / "12 minutes ago" — enough to judge whether a draft is the one.
 *
 * Deliberately its own module with no `"use client"` directive: it is called
 * from both a server component (the drafts list) and a client one (the editor's
 * recovery banner), and a helper that lives inside a client module cannot be
 * called during a server render at all.
 */
export function timeAgo(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
