import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata = {
  title: "Syndication API key · Help",
  description:
    "What the marketplace syndication API key is for, and when hosts need it.",
};

/**
 * In-app doc linked from Brand & website (i button).
 */
export default function SyndicationApiKeyHelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <p className="text-sm text-stone-500">
        <Link href="/admin/brand" className="font-medium text-bonnet hover:underline">
          ← Brand & website
        </Link>
        {" · "}
        <Link href="/help" className="hover:underline">
          Help
        </Link>
      </p>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Marketplace syndication API key
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Optional advanced tool for remote open-source hosts — not for normal
          hosted websites on Yall Come Back.
        </p>
      </div>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-stone-900">
          Who needs this?
        </h2>
        <p className="text-sm leading-relaxed text-stone-600">
          <strong>Most hosts can ignore this entirely.</strong> If your brand
          and listings live on this Yall Come Back app (paid hosting or free
          self-host on our platform), you publish listings here and optionally
          turn on marketplace. You never need a syndication key.
        </p>
        <p className="text-sm leading-relaxed text-stone-600">
          You only need a key if you run a <strong>separate copy</strong> of the
          open-source software on your own servers/database, and you still want
          those listings to appear on the <strong>central</strong> Yall Come Back
          marketplace.
        </p>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-stone-900">What the key does</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-stone-600">
          <li>
            Authenticates HTTP requests from your remote app to our API (
            <code className="rounded bg-stone-100 px-1 text-xs">
              /api/syndication/listings
            </code>
            ).
          </li>
          <li>
            Lets you create/update marketplace-facing listings for{" "}
            <em>this</em> host brand without logging into the admin UI each time.
          </li>
          <li>
            Is a secret like a password — treat it like a server env var, not a
            public website setting.
          </li>
        </ul>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-stone-900">What it does not do</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-stone-600">
          <li>It does not power your guest website or booking page.</li>
          <li>It does not connect Facebook, X, Instagram, or TikTok.</li>
          <li>It does not replace publishing listings in Admin → Properties.</li>
          <li>
            Rotating the key immediately invalidates the old one on remote
            servers.
          </li>
        </ul>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-stone-900">How to use it</h2>
        <ol className="list-inside list-decimal space-y-2 text-sm text-stone-600">
          <li>Generate or rotate the key on Brand &amp; website.</li>
          <li>Copy it once into your remote deploy secrets (it is only shown fully at generation time).</li>
          <li>
            Call the central API with{" "}
            <code className="rounded bg-stone-100 px-1 text-xs">
              Authorization: Bearer &lt;key&gt;
            </code>
            .
          </li>
          <li>
            Ensure marketplace is enabled for the brand and listings are
            published in the payload.
          </li>
        </ol>
        <p className="text-sm text-stone-600">
          Full technical guide:{" "}
          <Link
            href="/open-source#marketplace"
            className="font-semibold text-bonnet hover:underline"
          >
            Open source → marketplace
          </Link>
          {" "}
          (repo doc:{" "}
          <code className="rounded bg-stone-100 px-1 text-xs">
            docs/remote-open-source-marketplace.md
          </code>
          ).
        </p>
      </Card>

      <p className="text-center text-sm">
        <Link
          href="/admin/brand"
          className="font-semibold text-bonnet hover:underline"
        >
          ← Back to Brand & website
        </Link>
      </p>
    </div>
  );
}
