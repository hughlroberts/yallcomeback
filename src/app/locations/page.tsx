import { redirect } from "next/navigation";

/** Legacy Areas directory — send guests to marketplace search. */
export default function LocationsPage() {
  redirect("/marketplace");
}
