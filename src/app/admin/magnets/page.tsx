import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";
import { propertyScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fridge magnets · Admin" };

export default async function AdminMagnetsPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/magnets");

  const properties = await prisma.property.findMany({
    where: propertyScopeWhere(access),
    include: {
      host: { select: { name: true, slug: true } },
      images: { take: 1, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { title: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Fridge magnets"
        subtitle="Print one page per stay — large QR code guests can scan to open the listing and book again next year."
      />

      <div className="mb-6 rounded-2xl border border-blue-100 bg-petal/80 px-4 py-3 text-sm text-blue-900">
        <p className="font-medium">How to use</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-blue-900/85">
          <li>Open a magnet for the listing you want.</li>
          <li>Click <strong>Print this page</strong> (or Cmd/Ctrl+P).</li>
          <li>
            Use one page only — the layout is fixed to a single letter sheet.
            Cut or stick it on the fridge.
          </li>
        </ol>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
          No listings yet.{" "}
          <Link href="/admin/properties/new" className="font-medium text-bonnet">
            Create a listing
          </Link>{" "}
          first.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {properties.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{p.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {access.isPlatform ? `${p.host.name} · ` : ""}
                  {p.city || "No city"}
                  {p.published ? "" : " · Draft"}
                </p>
              </div>
              <Link
                href={`/admin/magnets/${p.id}`}
                className="shrink-0 rounded-xl bg-bonnet px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-bonnet-hover"
              >
                Open print page
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
