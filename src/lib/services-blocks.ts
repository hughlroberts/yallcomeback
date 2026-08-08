/**
 * Simple block model for the host "Other services" page.
 * Fixed block types only — not a freeform CMS.
 * Designed for fleets (e.g. 5 boat rentals) with photo + details + pricing.
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
  /** button href, or card body/details */
  secondary?: string;
  /** image URL for image blocks and service cards */
  imageUrl?: string;
  /** card pricing line, e.g. "$175 half day · $275 full day" */
  price?: string;
};

export const SERVICES_BLOCK_CATALOG: {
  type: ServicesBlockType;
  label: string;
  hint: string;
}[] = [
  { type: "heading", label: "Heading", hint: "Section title" },
  { type: "text", label: "Text", hint: "Paragraph" },
  {
    type: "card",
    label: "Boat / service card",
    hint: "Photo, title, details, pricing",
  },
  { type: "list", label: "Bullet list", hint: "One item per line" },
  { type: "image", label: "Image", hint: "Full-width photo" },
  { type: "button", label: "Button / link", hint: "Label + URL" },
  { type: "divider", label: "Divider", hint: "Horizontal line" },
];

export function newBlockId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

function boatCard(
  name: string,
  details: string,
  price = "Add pricing",
): ServicesBlock {
  return {
    id: newBlockId(),
    type: "card",
    content: name,
    secondary: details,
    price,
    imageUrl: "",
  };
}

/**
 * Starter layout for a boat rentals fleet page (Cherokee-style: ~5 boats).
 * Hosts fill in photos, real names, details, and rates on the live page.
 */
export function boatRentalsStarterBlocks(): ServicesBlock[] {
  return [
    {
      id: newBlockId(),
      type: "heading",
      content: "Boat rentals",
    },
    {
      id: newBlockId(),
      type: "text",
      content:
        "Make the most of the lake. Pick a boat, check the rate, and message us to reserve with your stay.",
    },
    boatCard(
      "Boat 1 — name this pontoon or ski boat",
      "Capacity, length, what’s included (life jackets, cooler, etc.).",
      "Half day $— · Full day $—",
    ),
    boatCard(
      "Boat 2",
      "Short description for guests — who it’s best for, key features.",
      "Half day $— · Full day $—",
    ),
    boatCard(
      "Boat 3",
      "Short description for guests — who it’s best for, key features.",
      "Half day $— · Full day $—",
    ),
    boatCard(
      "Boat 4",
      "Short description for guests — who it’s best for, key features.",
      "Half day $— · Full day $—",
    ),
    boatCard(
      "Boat 5",
      "Short description for guests — who it’s best for, key features.",
      "Half day $— · Full day $—",
    ),
    {
      id: newBlockId(),
      type: "list",
      content:
        "Life jackets included\nLocal launch guidance\nBook with your stay or message us",
    },
    {
      id: newBlockId(),
      type: "button",
      content: "Message us to book",
      secondary: "/about#contact",
    },
  ];
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
        content: "New boat or service",
        secondary:
          "Add capacity, features, and what’s included. Guests see this on your site.",
        price: "Half day $— · Full day $—",
        imageUrl: "",
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
        secondary: "Photo caption",
        imageUrl: "",
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

export function parseServicesBlocks(
  raw: string | null | undefined,
): ServicesBlock[] {
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
      .map((b) => {
        const type = b.type as ServicesBlockType;
        // Legacy image blocks stored URL in content
        const imageUrl =
          b.imageUrl != null
            ? String(b.imageUrl)
            : type === "image" && b.content
              ? String(b.content)
              : undefined;
        return {
          id: b.id,
          type,
          content: String(b.content ?? ""),
          secondary: b.secondary != null ? String(b.secondary) : undefined,
          imageUrl: imageUrl || undefined,
          price: b.price != null ? String(b.price) : undefined,
        };
      });
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
  return JSON.stringify(
    blocks.map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content,
      ...(b.secondary != null && b.secondary !== ""
        ? { secondary: b.secondary }
        : {}),
      ...(b.imageUrl != null && b.imageUrl !== ""
        ? { imageUrl: b.imageUrl }
        : {}),
      ...(b.price != null && b.price !== "" ? { price: b.price } : {}),
    })),
  );
}
