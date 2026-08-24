import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";

const API = "https://api.github.com";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** The GitHub access token for a user, from their linked GitHub account, or null. */
export async function getGithubToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ token: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
    .limit(1);
  return row?.token ?? null;
}

export interface GithubRepo {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

interface RepoResponse {
  owner: { login: string };
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
}

/** Repos the user can access — owned, collaborator, or via an org. */
export async function listRepos(token: string): Promise<GithubRepo[]> {
  const res = await fetch(
    `${API}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(`GitHub repos failed (${res.status})`);
  const data = (await res.json()) as RepoResponse[];
  return data.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
  }));
}

interface TreeResponse {
  tree: Array<{ path: string; type: string }>;
  truncated: boolean;
}

/** Every file path in a repo at a branch. `truncated` is true for very large repos. */
export async function listRepoFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<{ paths: string[]; truncated: boolean }> {
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(`GitHub tree failed (${res.status})`);
  const data = (await res.json()) as TreeResponse;
  return {
    paths: data.tree.filter((t) => t.type === "blob").map((t) => t.path),
    truncated: data.truncated,
  };
}

export function fileUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  /** `L47-L120` — GitHub highlights the span when the fragment is present. */
  lines?: string | null,
): string {
  const base = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
  return lines ? `${base}#${lines}` : base;
}

/**
 * A file's contents and current blob SHA, or null if it no longer exists.
 *
 * One call for both, because every caller that wants the text also wants the
 * SHA it belongs to — fetching them separately risks reading a file at one
 * commit and stamping it with another's SHA.
 */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<{ content: string; sha: string } | null> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/contents/${encoded}?ref=${branch}`,
    { headers: headers(token) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub file lookup failed (${res.status})`);

  const data = (await res.json()) as {
    sha: string;
    content?: string;
    encoding?: string;
    size: number;
  };

  // Over ~1MB the contents endpoint stops inlining the body. The SHA is still
  // good, so the caller can fall back to whole-file comparison.
  if (data.encoding !== "base64" || data.content === undefined) return null;

  return {
    sha: data.sha,
    content: Buffer.from(data.content, "base64").toString("utf8"),
  };
}

/** The current git blob SHA of a file, or null if it no longer exists. */
export async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string | null> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/contents/${encoded}?ref=${branch}`,
    { headers: headers(token) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub file lookup failed (${res.status})`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}
