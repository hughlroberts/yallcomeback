import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Geist_Mono } from "next/font/google";
import { SiteShell } from "@/components/site-shell";
import { RouteScrollReset } from "@/components/route-scroll-reset";
import { PRODUCT_NAME, PRODUCT_ORIGIN, PRODUCT_TAGLINE } from "@/lib/features";
import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE, seoOrigin } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || PRODUCT_NAME;
/** Prefer live product origin so metadataBase is never a build-time localhost. */
const siteUrl = seoOrigin() || PRODUCT_ORIGIN;

/**
 * Root defaults only. Do not set alternates.canonical here — that would make
 * every page canonical to the homepage. Each public page sets its own
 * canonical, og:url, and social tags via pageMetadata().
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description: PRODUCT_TAGLINE,
  applicationName: siteName,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName,
    title: siteName,
    description: PRODUCT_TAGLINE,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${siteName} — ${PRODUCT_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: PRODUCT_TAGLINE,
    images: [DEFAULT_TWITTER_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/ycb-seal-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#3A4A86",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
      // Extensions often inject attributes (e.g. cr-shortcut-listen) on html/body
      // before hydrate; suppress so that does not surface as an app error.
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col bg-buttermilk text-ink"
        suppressHydrationWarning
      >
        <RouteScrollReset />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
