import { notFound } from "next/navigation";
import { getHostForGuestSite } from "@/lib/host";
import { getHelpArticle } from "@/lib/help";
import { HelpArticleBody } from "@/components/help/help-articles";
import { generateMetadata as sharedMetadata } from "@/app/help/[slug]/page";

export const dynamic = "force-dynamic";
// The article is identical to global help; keep its global canonical.
export async function generateMetadata() {
  return sharedMetadata({ params: Promise.resolve({ slug: "cancellation-policies" }) });
}
export default async function BrandedCancellationPage({ params }: { params: Promise<{ hostSlug: string }> }) {
  const { hostSlug } = await params;
  if (!(await getHostForGuestSite(hostSlug))) notFound();
  const article = getHelpArticle("cancellation-policies");
  if (!article) notFound();
  return <HelpArticleBody article={article} hostSlug={hostSlug} />;
}
