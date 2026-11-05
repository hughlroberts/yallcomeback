import { redirect } from "next/navigation";

/** Old /admin/listings bookmark → properties list (E1104-A6). */
export default function AdminListingsRedirectPage() {
  redirect("/admin/properties");
}
