import { redirect } from "next/navigation";

/** Hosting moved to private ops portal */
export default function AdminHostingRedirect() {
  redirect("/ops/hosting");
}
