import Link from "next/link";
import { BrandPhraseSeal } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline bg-bonnet pb-[env(safe-area-inset-bottom,0px)] text-buttermilk/90">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Stable columns: brand never collides with link lists when seal grows */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            {/* Seal + copy side by side (logo left, words shift right) */}
            <div className="flex flex-row items-center gap-4 sm:gap-5">
              <BrandPhraseSeal
                size={280}
                className="h-24 w-24 shrink-0 sm:h-28 sm:w-28"
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-medium tracking-tight text-buttermilk sm:text-2xl">
                  yallcomeback.com
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-buttermilk/70 sm:mt-2">
                  The same stay minus the middle man. Your guests book you, not a
                  marketplace.
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-0">
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

          <div className="min-w-0">
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
