"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ADMIN_BRAND_COOKIE } from "@/lib/admin-brand-context";

/**
 * Platform admin: scope /admin to one host brand (Cherokee vs Hugh, etc.).
 * Hosts never call this — they only see their own brand.
 */
export async function setAdminBrandContext(formData: FormData) {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/admin");

  const hostId = String(formData.get("hostId") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/admin").trim();
  const safeReturn =
    returnTo.startsWith("/admin") || returnTo.startsWith("/ops")
      ? returnTo
      : "/admin";

  const jar = await cookies();

  if (!hostId || hostId === "all") {
    jar.delete(ADMIN_BRAND_COOKIE);
  } else {
    const host = await prisma.host.findFirst({
      where: { id: hostId },
      select: { id: true },
    });
    if (!host) {
      jar.delete(ADMIN_BRAND_COOKIE);
    } else {
      jar.set(ADMIN_BRAND_COOKIE, host.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 180, // 180 days
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin", "layout");
  revalidatePath("/ops");
  redirect(safeReturn.includes("?") ? safeReturn : `${safeReturn}?brand=1`);
}
