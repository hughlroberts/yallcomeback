import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/agent/origin";

export const dynamic = "force-dynamic";

/** Lightweight discoverability hint for AI tools. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  return NextResponse.json(
    {
      schema_version: "v1",
      name_for_human: "Yall Come Back",
      name_for_model: "yall_come_back",
      description_for_human:
        "Book-direct vacation rentals. Search Texas lakeside stays with exact or flexible dates.",
      description_for_model:
        "Use the public JSON API to search vacation rentals (location, guests, pets, exact or flexible dates) and fetch listing details. Prefer /api/v1/search and /api/v1/listings/{slug}. Read /llms.txt first.",
      auth: { type: "none" },
      api: {
        type: "openapi",
        url: `${origin}/api/v1/openapi.json`,
      },
      logo_url: `${origin}/brand/ycb-seal-512.png`,
      contact_email: "support@yallcomeback.com",
      legal_info_url: `${origin}/about`,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=3600",
      },
    },
  );
}
