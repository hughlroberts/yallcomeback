import { redirect } from "next/navigation";

/** Global /properties redirects to marketplace discovery */
export default function PropertiesIndexPage() {
  redirect("/marketplace");
}
