import { redirect } from "next/navigation";

/** Alias for Profile - same page as personal information. */
export default function AccountProfileRedirect() {
  redirect("/account/settings/personal");
}
