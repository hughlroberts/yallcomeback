import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticleBody } from "@/components/help/help-articles";
import { getHelpArticle, HELP_ARTICLES, helpPath } from "@/lib/help";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/page-json-ld";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) {
    return pageMetadata({
      title: "Help",
      description: "Yall Come Back help center.",
      path: "/help",
    });
  }
  return pageMetadata({
    title: article.title,
    description: article.description,
    path: helpPath(article.slug),
  });
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();
  return (
    <>
      <PageJsonLd
        path={helpPath(article.slug)}
        name={article.title}
        description={article.description}
        breadcrumbs={[
          { name: "Help center", path: "/help" },
          { name: article.title, path: helpPath(article.slug) },
        ]}
      />
      <HelpArticleBody article={article} />
    </>
  );
}
