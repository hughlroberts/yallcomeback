import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { webPageJsonLd, type WebPageKind } from "@/lib/json-ld";
import { seoOrigin } from "@/lib/seo";

/** WebPage + Organization JSON-LD for a public page, from its metadata. */
export function PageJsonLd({
  path,
  name,
  description,
  metadata,
  kind,
  breadcrumbs,
}: {
  path: string;
  name: string;
  description?: string;
  metadata?: Metadata;
  kind?: WebPageKind;
  breadcrumbs?: { name: string; path: string }[];
}) {
  const desc =
    description ??
    (typeof metadata?.description === "string" ? metadata.description : "");
  return (
    <JsonLd
      data={webPageJsonLd({
        origin: seoOrigin(),
        path,
        name,
        description: desc,
        kind,
        breadcrumbs,
      })}
    />
  );
}
