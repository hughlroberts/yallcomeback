import Link from "next/link";
import type { Metadata } from "next";
import { HELP_ARTICLES, HELP_CATEGORIES, helpPath } from "@/lib/help";

export const metadata: Metadata = {
  title: "Help center",
  description: "Yall Come Back help for hosts and guests. Written in clear, simple English.",
};

export default function HelpIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
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
                      className="block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md"
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
          className="font-semibold text-bonnet underline-offset-2 hover:underline"
        >
          Contact us
        </Link>
      </p>
    </div>
  );
}
