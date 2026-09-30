"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  INTENT_COOKIE,
  INTENT_MAX_AGE,
  parseVisitIntent,
  type VisitIntent,
} from "@/lib/intent-cookie";

const DEST: Record<VisitIntent, string> = {
  find: "/marketplace",
  host: "/for-hosts",
  browse: "/",
};

/** Remember Find a Place / Host a Place / browse, then send them on. */
export async function setVisitIntent(formData: FormData) {
  const intent = parseVisitIntent(String(formData.get("intent") || ""));
  if (!intent) redirect("/");

  const jar = await cookies();
  jar.set(INTENT_COOKIE, intent, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: INTENT_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  redirect(DEST[intent]);
}
