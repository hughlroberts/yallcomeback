import Link from "next/link";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";
import type { Metadata } from "next";
import { HELP_ARTICLES, HELP_CATEGORIES, helpPath } from "@/lib/help";
import { pageMetadata, seoAbsoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { helpFaqJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = pageMetadata({
  title: "Help center",
  description:
    "Yall Come Back help for hosts and guests. Written in clear, simple English.",
  path: "/help",
});

export default function HelpIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd
        data={helpFaqJsonLd({
          // Same articles, in the same order, as the list on this page.
          articles: HELP_CATEGORIES.flatMap((cat) =>
            HELP_ARTICLES.filter((a) => a.categoryId === cat.id),
          ),
          urlFor: (slug) => seoAbsoluteUrl(helpPath(slug)),
        })}
      />
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
        Help center
      </h1>
      <p className="mt-2 text-stone-600">
        Clear guides for hosts and guests. Topics include search, booking,
        hosting, and policies.
      </p>

      <div className="mt-10 space-y-12">
        {HELP_CATEGORIES.map((cat) => {
          const articles = HELP_ARTICLES.filter(
            (a) => a.categoryId === cat.id
          );
          if (articles.length === 0) return null;
          return (
            <section key={cat.id} id={cat.id}>
              <h2 className="text-lg font-semibold text-stone-900">
                {cat.title}
              </h2>
              <p className="mt-1 text-sm text-stone-500">{cat.description}</p>
              <ul className="mt-4 space-y-3">
                {articles.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={helpPath(a.slug)}
                      className={`block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md ${PRIMARY_CTA_FOCUS_CLASS}`}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        {a.category}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-stone-900">
                        {a.title}
                      </h3>
                      <p className="mt-1 text-sm text-stone-600">{a.body}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-14 text-center text-sm text-stone-500">
        Need more help?{" "}
        <Link
          href="/contact"
          className={`font-semibold text-bonnet underline-offset-2 hover:underline ${PRIMARY_CTA_FOCUS_CLASS}`}
        >
          Contact us
        </Link>
      </p>
    </div>
  );
}
