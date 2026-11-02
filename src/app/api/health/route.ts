/**
 * Deploy health check. The server only listens after the schema push at
 * startup, so a 200 here means this container is ready for traffic.
 * No database call: a slow database must not hold back or fail a deploy.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
