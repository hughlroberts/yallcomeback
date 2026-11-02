import { jsonLdScriptBody } from "@/lib/json-ld";

/** Renders one schema.org JSON-LD script. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScriptBody(data) }}
    />
  );
}
