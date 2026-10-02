import { NextResponse } from "next/server";
import { isAgentApiEnabled } from "@/lib/platform-features";

/** 404 with no body or CORS when the agent API is off (MIT self-host). */
export function agentApiDisabledResponse(): NextResponse | null {
  if (isAgentApiEnabled()) return null;
  return new NextResponse(null, { status: 404 });
}
