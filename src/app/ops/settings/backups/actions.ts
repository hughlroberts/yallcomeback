"use server";

import { redirect } from "next/navigation";
import { requirePlatformAdminOr404 } from "@/lib/auth";
import { copyVolumeBackupsToBucket } from "@/lib/backup";

const PAGE = "/ops/settings/backups";

/** Copy volume backups to the bucket and verify (never deletes). */
export async function copyBackupsToBucket(formData: FormData) {
  await requirePlatformAdminOr404();
  const dryRun = formData.get("dryRun") === "1";
  let qs: string;
  try {
    const r = await copyVolumeBackupsToBucket({ dryRun });
    console.log("[backup:copy-to-bucket]", JSON.stringify(r));
    const bad = r.items.filter((i) => i.status === "mismatch" || i.status === "failed");
    const toCopy = r.items.filter((i) => i.status === "would_copy").length;
    qs = new URLSearchParams({
      copy: dryRun ? "dry" : r.ok ? "ok" : "fail",
      total: String(r.volumeCount),
      verified: String(r.verifiedInBucket),
      todo: String(toCopy),
      bad: bad.map((i) => i.name).slice(0, 5).join(","),
    }).toString();
  } catch (e) {
    qs = new URLSearchParams({
      copy: "error",
      msg: (e instanceof Error ? e.message : "copy failed").slice(0, 200),
    }).toString();
  }
  redirect(`${PAGE}?${qs}#move`);
}
