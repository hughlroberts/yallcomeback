import { redirect } from "next/navigation";
import { updateLanguageCurrency } from "@/app/actions/account";
import {
  AccountSettingsShell,
  SavedBanner,
} from "@/components/account-settings-shell";
import { Button, Label, Select } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Languages & currency" };

export default async function LanguagePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  const isHost = user.role === "HOST" || user.role === "ADMIN";

  return (
    <AccountSettingsShell
      active="language"
      isHost={isHost}
      title="Languages & currency"
    >
      <SavedBanner show={params.saved === "1"} />

      <p className="text-sm text-stone-600">
        Yall Come Back is built for the US (Texas): dollars and miles. These
        preferences are stored on your account for future localization.
      </p>

      <form action={updateLanguageCurrency} className="mt-8 max-w-sm space-y-4">
        <div>
          <Label htmlFor="language">Language</Label>
          <Select
            id="language"
            name="language"
            defaultValue={user.language || "en-US"}
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es-US">Español (US)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="currencyDisplay">Currency display</Label>
          <Select
            id="currencyDisplay"
            name="currencyDisplay"
            defaultValue={user.currencyDisplay || "USD"}
          >
            <option value="USD">US dollar ($)</option>
          </Select>
          <p className="mt-1 text-xs text-stone-400">
            Listings and deposits are priced in USD.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-700">Distance units</p>
          <p className="mt-1 text-sm text-stone-500">Miles only</p>
        </div>
        <Button type="submit">Save</Button>
      </form>
    </AccountSettingsShell>
  );
}
