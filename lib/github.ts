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

/**
 * A token that can read repository contents, preferring the acting user's own.
 *
 * The deployment may hold a **public-repo, read-only** token of the owner's, so
 * that someone without a linked account can still browse and cite the code the
 * workspace points at. That token is the owner's own and can reach nothing
 * private, which is the whole reason it is safe to hold where a user's `repo`
 * token would not be.
 *
 * A linked account still wins: it can see private repositories the fallback
 * cannot, and it is the person's own access rather than a borrowed one.
 */
export async function getReadToken(userId: string): Promise<string | null> {
  const linked = await getGithubToken(userId);
  if (linked) return linked;
  return process.env.GITHUB_PUBLIC_TOKEN?.trim() || null;
}

/**
 * Repository trees, cached briefly in the running instance.
 *
 * A tree is a few hundred KB and changes rarely, while the file picker asks for
 * every connected repo on every mount. Without this, a handful of visitors
 * opening the compose screen would spend the hourly API budget on identical
 * answers. Per-instance and short-lived on purpose: correctness here is "recent
 * enough to cite from", not "current to the second".
 */
const TREE_TTL_MS = 5 * 60 * 1000;
const treeCache = new Map<string, { at: number; value: { paths: string[]; truncated: boolean } }>();

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

/** Repos the user can access: owned, collaborator, or via an org. */
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
  const key = `${owner}/${repo}@${branch}`;
  const hit = treeCache.get(key);
  if (hit && Date.now() - hit.at < TREE_TTL_MS) return hit.value;

  const res = await fetch(
    `${API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(`GitHub tree failed (${res.status})`);
  const data = (await res.json()) as TreeResponse;
  const value = {
    paths: data.tree.filter((t) => t.type === "blob").map((t) => t.path),
    truncated: data.truncated,
  };
  treeCache.set(key, { at: Date.now(), value });
  return value;
}

export function fileUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  /** `L47-L120`. GitHub highlights the span when the fragment is present. */
  lines?: string | null,
): string {
  const base = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
  return lines ? `${base}#${lines}` : base;
}

/**
 * A file's contents and current blob SHA, or null if it no longer exists.
 *
 * One call for both, because every caller that wants the text also wants the
 * SHA it belongs to. Fetching them separately risks reading a file at one
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
