import Link from "next/link";
import { BrandSeal } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline bg-bonnet text-buttermilk/90">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-3 sm:px-6">
        <div className="flex items-start gap-5 sm:col-span-1">
          <BrandSeal
            size={280}
            mono
            className="h-28 w-28 shrink-0 sm:h-36 sm:w-36 lg:h-40 lg:w-40"
          />
          <div className="min-w-0 pt-1">
            <p className="font-display text-xl font-medium tracking-tight text-buttermilk sm:text-2xl">
              yallcomeback.com
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-buttermilk/70">
              The same stay minus the middle man. Your guests book you, not a
              marketplace.
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-buttermilk/50">
            Explore
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/marketplace" className="hover:text-honey">
                Browse stays
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-honey">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-honey">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/help" className="hover:text-honey">
                Help center
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-buttermilk/50">
            For hosts
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/for-hosts" className="hover:text-honey">
                List your property
              </Link>
            </li>
            <li>
              <Link href="/self-host" className="hover:text-honey">
                Free self-host deploy
              </Link>
            </li>
            <li>
              <Link href="/open-source" className="hover:text-honey">
                Open source features
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-honey">
                Host sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-buttermilk/50 sm:px-6">
          <p>© {new Date().getFullYear()} yallcomeback.com</p>
          <p className="text-honey/90">Made in Texas by Texans.</p>
        </div>
      </div>
    </footer>
  );
}
