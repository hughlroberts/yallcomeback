import { redirect } from "next/navigation";

export default function OpsBackupsRedirect() {
  redirect("/ops/settings/backups");
}
