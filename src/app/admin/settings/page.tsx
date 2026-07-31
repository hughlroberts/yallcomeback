import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";

/**
 * Platform settings are under /ops. Hosts get account settings instead of a
 * hard bounce to ops (admin_only).
 */
export default async function AdminSettingsPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/settings");

  if (access.isPlatform) {
    redirect("/ops/settings");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
      <Card className="space-y-3 p-6">
        <p className="text-sm text-stone-600">
          Platform-wide settings are only available to Yall Come Back operators.
          Update your personal account and notifications under Account settings.
        </p>
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/account/settings" className="text-bonnet hover:underline">
            Account settings
          </Link>
          <Link href="/admin" className="text-bonnet hover:underline">
            ← Host admin
          </Link>
        </div>
      </Card>
    </div>
  );
}
