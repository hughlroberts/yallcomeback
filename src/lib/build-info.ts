/**
 * Short git SHA of the running build. The host sets RAILWAY_GIT_COMMIT_SHA;
 * GIT_COMMIT_SHA is the fallback for other hosts and self-hosted copies.
 * Without either (or with a value that is not a SHA) it is "unknown".
 */
export function buildCommitId(
  env: Record<string, string | undefined> = process.env,
): string {
  for (const raw of [env.RAILWAY_GIT_COMMIT_SHA, env.GIT_COMMIT_SHA]) {
    const sha = raw?.trim().toLowerCase() ?? "";
    if (/^[0-9a-f]{7,40}$/.test(sha)) return sha.slice(0, 7);
  }
  return "unknown";
}
