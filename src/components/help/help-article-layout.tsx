import Link from "next/link";
import type { ReactNode } from "react";
import {
  getHelpArticle,
  helpPath,
  type HelpArticle,
} from "@/lib/help";

type RelatedLink = {
  href: string;
  title: string;
  description?: string;
};

type Props = {
  article: HelpArticle;
  children: ReactNode;
  /** Extra related links (e.g. product pages) after catalog related articles */
  extraRelated?: RelatedLink[];
};

export function HelpArticleLayout({
  article,
  children,
  extraRelated,
}: Props) {
  const relatedFromCatalog = (article.related ?? [])
    .map((slug) => getHelpArticle(slug))
    .filter((a): a is HelpArticle => Boolean(a));

  return (
    <div className="bg-white">
      <div className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-sm font-medium text-stone-500">
            <Link href="/help" className="hover:text-stone-800 hover:underline">
              Help
            </Link>
            <span className="mx-1.5 text-stone-300">/</span>
            <span>{article.category}</span>
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {article.title}
          </h1>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {children}

        {(relatedFromCatalog.length > 0 ||
          (extraRelated && extraRelated.length > 0)) && (
          <section className="mt-12 space-y-4 border-t border-stone-200 pt-10">
            <h2 className="text-xl font-semibold text-stone-900">
              Related help
            </h2>
            <ul className="space-y-3 text-[15px]">
              {relatedFromCatalog.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={helpPath(a.slug)}
                    className="font-semibold text-bonnet underline-offset-2 hover:underline"
                  >
                    {a.title}
                  </Link>
                  <p className="text-stone-500">{a.body}</p>
                </li>
              ))}
              {extraRelated?.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-semibold text-bonnet underline-offset-2 hover:underline"
                  >
                    {link.title}
                  </Link>
                  {link.description ? (
                    <p className="text-stone-500">{link.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 text-center text-sm text-stone-400">
          Yall Come Back help · {article.title}
        </p>
      </article>
    </div>
  );
}

/** Lead paragraph under the title (inside article body) */
export function HelpLead({ children }: { children: ReactNode }) {
  return (
    <p className="-mt-2 mb-10 text-lg leading-relaxed text-stone-600">
      {children}
    </p>
  );
}

export function HelpSection({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mt-12 space-y-4 first:mt-0">
      <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

export function HelpP({ children }: { children: ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed text-stone-700">{children}</p>
  );
}

export function HelpUl({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-stone-700">
      {children}
    </ul>
  );
}

export function HelpH3({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <h3 id={id} className="text-lg font-semibold text-stone-900">
      {children}
    </h3>
  );
}
