import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata = {
  title: "Syndication API key · Help",
  description:
    "What the marketplace syndication key is for, and when hosts need it.",
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
          Marketplace syndication key
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Optional tool for people who run their own copy of the software. Most
          hosts on Yall Come Back never need this.
        </p>
      </div>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-stone-900">
          Who needs this?
        </h2>
        <p className="text-sm leading-relaxed text-stone-600">
          <strong>Most hosts can ignore this.</strong> If your brand and
          listings live on this Yall Come Back site (paid hosting or free
          self-host here), you publish listings here. You never need a
          syndication key.
        </p>
        <p className="text-sm leading-relaxed text-stone-600">
          You only need a key if you run a <strong>separate copy</strong> of
          the open-source software on your own servers, and you still want
          those listings on the Yall Come Back marketplace.
        </p>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-stone-900">What the key does</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-stone-600">
          <li>
            Lets your own copy of the software send listings to the Yall Come
            Back marketplace.
          </li>
          <li>
            Treat it like a password. Copy it once when you generate it.
          </li>
        </ul>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-stone-900">What it does not do</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-stone-600">
          <li>It does not power your guest website or booking page.</li>
          <li>It does not connect Facebook, X, Instagram, or TikTok.</li>
          <li>It does not replace publishing listings in Admin → Listings.</li>
          <li>A new key replaces the old one immediately.</li>
        </ul>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-stone-900">How to use it</h2>
        <ol className="list-inside list-decimal space-y-2 text-sm text-stone-600">
          <li>Generate or rotate the key on Brand &amp; website.</li>
          <li>
            Copy it once into your remote site. It is only shown fully at
            generation time.
          </li>
          <li>
            Follow the marketplace steps on the{" "}
            <Link
              href="/open-source#marketplace"
              className="font-semibold text-bonnet hover:underline"
            >
              Open source
            </Link>{" "}
            page.
          </li>
        </ol>
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
