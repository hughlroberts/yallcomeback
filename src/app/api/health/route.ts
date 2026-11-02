/**
 * Deploy health check. The server only listens after the schema push at
 * startup, so a 200 here means this container is ready for traffic.
 * No database call: a slow database must not hold back or fail a deploy.
 *
 * `commit` is the short git SHA of the running build, so you can tell which
 * deploy answered (useful during a rollout). See buildCommitId.
 */
import { buildCommitId } from "@/lib/build-info";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: true, commit: buildCommitId() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
