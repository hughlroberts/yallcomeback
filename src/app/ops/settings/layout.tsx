import { OpsSettingsSidebar } from "@/components/ops-settings-sidebar";

export default function OpsSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <OpsSettingsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
