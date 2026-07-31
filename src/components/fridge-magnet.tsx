/**
 * Single-page fridge magnet layout.
 * Print CSS forces letter portrait, hides chrome, no page 2.
 */
export function FridgeMagnet({
  propertyTitle,
  hostName,
  listingUrl,
  qrSvg,
  siteName,
  brandMarkSrc = "/brand/ycb-seal.svg",
}: {
  propertyTitle: string;
  hostName: string;
  listingUrl: string;
  qrSvg: string;
  siteName: string;
  /** Seal or host logo shown above the title */
  brandMarkSrc?: string;
}) {
  const isHostLogo = brandMarkSrc !== "/brand/ycb-seal.svg";
  return (
    <div
      id="print-magnet"
      className="magnet-sheet mx-auto flex w-full max-w-[7.5in] flex-col items-center justify-between rounded-3xl border-2 border-slate-900 bg-white px-6 py-7 text-center shadow-sm sm:px-8 sm:py-8"
    >
      <div className="w-full shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brandMarkSrc}
          alt=""
          width={72}
          height={72}
          className={
            isHostLogo
              ? "mx-auto h-[4.5rem] w-[4.5rem] rounded-full object-cover ring-1 ring-slate-200"
              : "mx-auto h-[4.5rem] w-[4.5rem]"
          }
        />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-bonnet">
          Book again next year
        </p>
        <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {propertyTitle}
        </h1>
        <p className="mt-1.5 text-sm font-medium text-slate-600">
          Hosted by {hostName}
        </p>
      </div>

      <div className="my-4 flex w-full max-w-[4.75in] flex-1 flex-col items-center justify-center">
        <div
          className="magnet-qr w-full max-w-[4.75in] [&_svg]:h-auto [&_svg]:w-full"
          // Server-generated QR SVG — black modules on white for clean scans
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </div>

      <div className="w-full shrink-0 space-y-2">
        <p className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
          Scan to open this stay &amp; reserve
        </p>
        <p className="text-sm text-slate-600">
          Stick this on the fridge. Point a phone camera at the code when you
          want the same place next year.
        </p>
        <p className="break-all font-mono text-[10px] leading-snug text-slate-400">
          {listingUrl}
        </p>
        <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {siteName}
        </p>
      </div>
    </div>
  );
}

/** Injected once on magnet print pages. */
export const MAGNET_PRINT_CSS = `
@media print {
  @page {
    size: letter portrait;
    margin: 0.4in;
  }

  html, body {
    background: white !important;
    height: auto !important;
    overflow: hidden !important;
  }

  /* Hide app chrome */
  body > header,
  body > footer,
  .no-print {
    display: none !important;
  }

  main {
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Admin shell wrappers */
  body > main > div {
    min-height: 0 !important;
    background: white !important;
  }
  body > main > div > div:first-child {
    display: none !important;
  }
  body > main > div > div:last-child {
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  #print-magnet-wrap {
    margin: 0 !important;
    padding: 0 !important;
  }

  .magnet-sheet {
    max-width: none !important;
    width: 100% !important;
    height: 10in !important;
    max-height: 10in !important;
    box-shadow: none !important;
    border-radius: 0.25in !important;
    border-width: 2pt !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-after: avoid !important;
    overflow: hidden !important;
    padding: 0.35in 0.4in !important;
  }

  .magnet-qr {
    max-width: 5in !important;
    width: 5in !important;
  }

  .magnet-qr svg {
    width: 100% !important;
    height: auto !important;
  }
}
`;
