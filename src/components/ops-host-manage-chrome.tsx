import Link from "next/link";

/**
 * Focused chrome while managing one host brand from Ops.
 * Hides the global Ops section tabs so you stay in this site’s cockpit.
 */
export function OpsHostManageChrome({
  hostName,
  hostSlug,
  hostId,
}: {
  hostName: string;
  hostSlug: string;
  hostId: string;
}) {
  return (
    <div className="border-b border-bonnet/20 bg-bonnet/[0.04]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-bonnet/80">
            Managing website
          </p>
          <p className="truncate text-sm font-semibold text-stone-900">
            {hostName}
            <span className="ml-1.5 font-normal text-stone-500">
              ({hostSlug})
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/brand?hostId=${hostId}`}
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
          >
            Brand &amp; website
          </Link>
          <Link
            href={`/h/${hostSlug}`}
            target="_blank"
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
          >
            Guest site →
          </Link>
          <Link
            href="/ops/hosting"
            className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
          >
            ← Exit to Ops Panel
          </Link>
        </div>
      </div>
    </div>
  );
}
