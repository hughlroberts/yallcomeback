import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import { buildOpenApiDocument } from "@/lib/agent/openapi";

export const dynamic = "force-dynamic";

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
