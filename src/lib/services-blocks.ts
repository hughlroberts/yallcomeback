/**
 * Simple block model for the host "Other services" page.
 * Fixed block types only — not a freeform CMS.
 */

export type ServicesBlockType =
  | "heading"
  | "text"
  | "image"
  | "button"
  | "list"
  | "divider"
  | "card";

export type ServicesBlock = {
  id: string;
  type: ServicesBlockType;
  /** heading / text / button label / card title / list as newline-separated */
  content: string;
  /** image URL, button href, or card body */
  secondary?: string;
};

export const SERVICES_BLOCK_CATALOG: {
  type: ServicesBlockType;
  label: string;
  hint: string;
}[] = [
  { type: "heading", label: "Heading", hint: "Section title" },
  { type: "text", label: "Text", hint: "Paragraph" },
  { type: "card", label: "Service card", hint: "Title + details" },
  { type: "list", label: "Bullet list", hint: "One item per line" },
  { type: "image", label: "Image", hint: "Photo URL" },
  { type: "button", label: "Button / link", hint: "Label + URL" },
  { type: "divider", label: "Divider", hint: "Horizontal line" },
];

export function newBlockId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlock(type: ServicesBlockType): ServicesBlock {
  switch (type) {
    case "heading":
      return { id: newBlockId(), type, content: "Our services" };
    case "text":
      return {
        id: newBlockId(),
        type,
        content: "Tell guests what else you offer beyond the stay.",
      };
    case "card":
      return {
        id: newBlockId(),
        type,
        content: "Pontoon boat rental",
        secondary: "Half-day and full-day options. Book when you reserve your stay.",
      };
    case "list":
      return {
        id: newBlockId(),
        type,
        content: "Kayaks\nFirewood\nLake maps",
      };
    case "image":
      return {
        id: newBlockId(),
        type,
        content: "",
        secondary: "Photo of our pontoon",
      };
    case "button":
      return {
        id: newBlockId(),
        type,
        content: "Contact us",
        secondary: "/about#contact",
      };
    case "divider":
      return { id: newBlockId(), type, content: "" };
    default:
      return { id: newBlockId(), type: "text", content: "" };
  }
}

export function parseServicesBlocks(raw: string | null | undefined): ServicesBlock[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (b): b is ServicesBlock =>
          Boolean(b) &&
          typeof b === "object" &&
          typeof (b as ServicesBlock).id === "string" &&
          typeof (b as ServicesBlock).type === "string",
      )
      .map((b) => ({
        id: b.id,
        type: b.type as ServicesBlockType,
        content: String(b.content ?? ""),
        secondary: b.secondary != null ? String(b.secondary) : undefined,
      }));
  } catch {
    return [];
  }
}

/** Migrate plain-text body into a single text block when blocks empty. */
export function blocksFromHost(opts: {
  siteServicesBlocks?: string | null;
  siteServicesBody?: string | null;
}): ServicesBlock[] {
  const blocks = parseServicesBlocks(opts.siteServicesBlocks);
  if (blocks.length > 0) return blocks;
  const body = opts.siteServicesBody?.trim();
  if (body) {
    return [{ id: newBlockId(), type: "text", content: body }];
  }
  return [];
}

export function serializeServicesBlocks(blocks: ServicesBlock[]): string {
  return JSON.stringify(blocks);
}
