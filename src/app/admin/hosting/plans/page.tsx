import { redirect } from "next/navigation";

export default function AdminHostingPlansRedirect() {
  redirect("/ops/hosting/plans");
}
