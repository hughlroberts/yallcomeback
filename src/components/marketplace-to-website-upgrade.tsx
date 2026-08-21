import Link from "next/link";
import { upgradeToBrandedWebsite } from "@/app/actions/host";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  hostId: string;
  hostName: string;
  previewPath: string;
};

/**
 * Shown to marketplace-only hosts: one clear path to a branded site + domain.
 * Domain purchase stays at their registrar — we unlock the product and DNS steps.
 */
export function MarketplaceToWebsiteUpgrade({
  hostId,
  hostName,
  previewPath,
}: Props) {
  return (
    <div className="space-y-4 rounded-2xl border border-bonnet/25 bg-gradient-to-br from-petal/70 to-white p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bonnet/80">
          Upgrade · branded website
        </p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Want {hostName} on your own domain?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
          You already list on Find a Place. Add a branded guest site (logo,
          colors, About, services) hosted by Yall Come Back. Guests can book on{" "}
          <strong className="font-semibold text-stone-800">your domain</strong>{" "}
          while marketplace stays included — no second fee.
        </p>
      </div>

      <ol className="space-y-2.5 text-sm text-stone-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bonnet text-[11px] font-bold text-white">
            1
          </span>
          <span>
            <strong className="text-stone-900">Upgrade here</strong> — switches
            you to the branded website plan ($15 / published listing / month)
            and unlocks Brand tools.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-700">
            2
          </span>
          <span>
            <strong className="text-stone-900">Buy a domain</strong> at GoDaddy,
            Namecheap, Google Domains, or similar (not sold inside Yall Come
            Back).
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-700">
            3
          </span>
          <span>
            <strong className="text-stone-900">Enter it on Brand</strong> — we
            prepare DNS values; you paste them at your registrar. Preview stays
            at{" "}
            <code className="rounded bg-white px-1 text-xs">{previewPath}</code>{" "}
            until cutover.
          </span>
        </li>
      </ol>

      <form action={upgradeToBrandedWebsite} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="hostId" value={hostId} />
        <SubmitButton className="rounded-full bg-bonnet px-5 py-2.5 text-sm font-semibold text-white hover:bg-bonnet/90">
          Create my branded website
        </SubmitButton>
        <Link
          href="/help/branded-website"
          className="text-sm font-semibold text-bonnet hover:underline"
        >
          How domains work →
        </Link>
      </form>

      <p className="text-xs text-stone-500">
        Marketplace listing stays on. You can turn it off later per stay if you
        want. Downgrading back to marketplace-only is available under “How
        guests find you.”
      </p>
    </div>
  );
}
