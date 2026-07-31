import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AccountIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/account/settings/personal");
  redirect("/account/settings/personal");
}
