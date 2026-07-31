import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticleBody } from "@/components/help/help-articles";
import { getHelpArticle, HELP_ARTICLES } from "@/lib/help";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) return { title: "Help" };
  return {
    title: article.title,
    description: article.description,
  };
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();
  return <HelpArticleBody article={article} />;
}
