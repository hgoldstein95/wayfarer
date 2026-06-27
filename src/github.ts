/**
 * Parsing and resolution for GitHub-hosted tours.
 *
 * We accept a GitHub "blob" URL pointing at the tour JSON, e.g.
 *   https://github.com/user/repo/blob/main/dir/tour.json
 * and derive the pieces needed to fetch the tour and resolve the relative
 * file paths it references (which are relative to the tour file's directory).
 */

export interface RepoLocation {
  owner: string;
  repo: string;
  branch: string;
  /** Full path to the tour file within the repo, e.g. "dir/tour.json". */
  path: string;
  /** Directory containing the tour file, e.g. "dir" ("" for repo root). */
  baseDir: string;
}

/** Parse a github.com/.../blob/... URL into its components. */
export function parseBlobUrl(input: string): RepoLocation {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`"${input}" is not a valid URL.`);
  }

  // Allow raw.githubusercontent.com URLs too, normalizing them.
  if (url.hostname === "raw.githubusercontent.com") {
    const parts = url.pathname.replace(/^\//, "").split("/");
    if (parts.length < 4) {
      throw new Error("Raw GitHub URL does not include owner/repo/branch/path.");
    }
    const [owner, repo, branch, ...rest] = parts;
    const path = rest.join("/");
    return { owner, repo, branch, path, baseDir: dirname(path) };
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Tour URL must point to github.com.");
  }

  const parts = url.pathname.replace(/^\//, "").split("/");
  // /owner/repo/blob/branch/path...
  if (parts.length < 5 || parts[2] !== "blob") {
    throw new Error(
      "Expected a GitHub blob URL like https://github.com/owner/repo/blob/branch/path/tour.json",
    );
  }
  const [owner, repo, , branch, ...rest] = parts;
  const path = rest.join("/");
  return { owner, repo, branch, path, baseDir: dirname(path) };
}

/**
 * Parse a plain repository URL into a RepoLocation rooted at the repo root.
 *
 * Used for a tour's optional `externalRepository`: the tour lives in one repo
 * but its stop files live in another, with paths relative to that repo's root
 * (so `baseDir` is "" here). Accepts:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/branch
 * When no branch is given we use "HEAD", which raw.githubusercontent.com and
 * github.com both resolve to the repo's default branch.
 */
export function parseRepoUrl(input: string): RepoLocation {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`"${input}" is not a valid repository URL.`);
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("externalRepository must be a github.com URL.");
  }

  const parts = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(
      "externalRepository URL must include an owner and repo, like https://github.com/owner/repo",
    );
  }
  const [owner, repo] = parts;
  // Optional /tree/<branch> suffix; default to HEAD (the default branch).
  const branch =
    parts.length >= 4 && parts[2] === "tree" ? parts.slice(3).join("/") : "HEAD";

  return { owner, repo, branch, path: "", baseDir: "" };
}

/** Raw content URL for the tour file itself. */
export function tourRawUrl(loc: RepoLocation): string {
  return rawUrl(loc, loc.path);
}

/** Raw content URL for a stop's file, given a path relative to the tour dir. */
export function stopRawUrl(loc: RepoLocation, relativeFile: string): string {
  const resolved = resolvePath(loc.baseDir, relativeFile);
  return rawUrl(loc, resolved);
}

/** Human-facing github.com link for a resolved repo path (optionally a line). */
export function blobLink(
  loc: RepoLocation,
  relativeFile: string,
  line?: number,
): string {
  const resolved = resolvePath(loc.baseDir, relativeFile);
  const frag = line ? `#L${line}` : "";
  return `https://github.com/${loc.owner}/${loc.repo}/blob/${loc.branch}/${resolved}${frag}`;
}

function rawUrl(loc: RepoLocation, fullPath: string): string {
  return `https://raw.githubusercontent.com/${loc.owner}/${loc.repo}/${loc.branch}/${fullPath}`;
}

/** Directory portion of a repo path ("a/b/c.json" -> "a/b", "c.json" -> ""). */
export function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

/**
 * Resolve a relative path against a base directory, collapsing "." and "..".
 * Both inputs use forward slashes (repo paths). The result never escapes to an
 * absolute path; leading "../" that would go above the repo root is dropped.
 */
export function resolvePath(baseDir: string, relative: string): string {
  // An absolute-looking path (leading "/") is treated as repo-root relative.
  const segments = relative.startsWith("/")
    ? relative.slice(1).split("/")
    : [...(baseDir ? baseDir.split("/") : []), ...relative.split("/")];

  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      stack.pop();
    } else {
      stack.push(seg);
    }
  }
  return stack.join("/");
}
