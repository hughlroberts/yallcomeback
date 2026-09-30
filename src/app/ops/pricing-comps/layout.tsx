import { OpsPricingCompsNav } from "@/components/ops-pricing-comps-nav";

export default function OpsPricingCompsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <OpsPricingCompsNav />
      {children}
    </div>
  );
}
