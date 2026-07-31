import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/settings");
  }
  return <>{children}</>;
}
