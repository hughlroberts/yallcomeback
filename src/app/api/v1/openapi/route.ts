import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import { buildOpenApiDocument } from "@/lib/agent/openapi";

export const dynamic = "force-dynamic";

/**
 * E1104-C9: /api/v1/openapi (no .json) serves the same OpenAPI 3.1 document as
 * /api/v1/openapi.json so agents that omit the extension still get the spec.
 */
export async function GET(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  const origin = publicOrigin(req);
  return NextResponse.json(buildOpenApiDocument(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
