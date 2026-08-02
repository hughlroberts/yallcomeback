import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/features";
import { getRequestTenant } from "@/lib/tenant";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
// Must not use headers() during static generateStaticParams at build time.
// Runtime requests still resolve tenant via getRequestTenant (safe try/catch).
export const dynamic = "force-dynamic";
export const alt = `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`;

/**
 * iMessage / social link preview.
 * Platform: YCB seal + tagline. Host tenant (custom domain): host brand.
 */
export default async function OpenGraphImage() {
  const tenant = await getRequestTenant();

  if (tenant) {
    return hostOgCard(tenant);
  }
  return platformOgCard();
}

async function platformOgCard() {
  let sealSrc: string | null = null;
  try {
    const bytes = await readFile(
      join(process.cwd(), "public/brand/ycb-seal-1024.png"),
    );
    sealSrc = `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    sealSrc = null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#3A4A86",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(160deg, #3A4A86 0%, #2A3566 55%, #26325F 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 64px",
            gap: 28,
          }}
        >
          {sealSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sealSrc}
              width={280}
              height={280}
              alt=""
              style={{ borderRadius: 140 }}
            />
          ) : (
            <div
              style={{
                width: 280,
                height: 280,
                borderRadius: 140,
                border: "4px solid #E8CE96",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#E8CE96",
                fontSize: 56,
              }}
            >
              YCB
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 500,
                color: "#FBF7EF",
                letterSpacing: "-0.02em",
                textAlign: "center",
              }}
            >
              {PRODUCT_NAME}
            </div>
            <div
              style={{
                fontSize: 32,
                color: "#E8CE96",
                textAlign: "center",
                maxWidth: 900,
                lineHeight: 1.3,
              }}
            >
              {PRODUCT_TAGLINE}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

async function hostOgCard(host: {
  name: string;
  tagline: string | null;
  primaryColor: string;
  logoUrl: string | null;
}) {
  const bg = /^#[0-9A-Fa-f]{6}$/.test(host.primaryColor)
    ? host.primaryColor
    : "#1e293b";
  let logoSrc: string | null = null;
  if (host.logoUrl?.startsWith("http")) {
    logoSrc = host.logoUrl;
  } else if (host.logoUrl?.startsWith("/")) {
    try {
      const bytes = await readFile(
        join(process.cwd(), "public", host.logoUrl.replace(/^\//, "")),
      );
      const ext = host.logoUrl.split(".").pop()?.toLowerCase();
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : "image/png";
      logoSrc = `data:${mime};base64,${bytes.toString("base64")}`;
    } catch {
      logoSrc = null;
    }
  }

  const tagline =
    host.tagline || "Book direct — no marketplace middleman.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 64px",
            gap: 40,
          }}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              width={220}
              height={220}
              alt=""
              style={{ borderRadius: 110, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: 110,
                border: "4px solid rgba(255,255,255,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FBF7EF",
                fontSize: 72,
                fontWeight: 600,
              }}
            >
              {host.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 16,
              maxWidth: 700,
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 500,
                color: "#FBF7EF",
                letterSpacing: "-0.02em",
              }}
            >
              {host.name}
            </div>
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.35,
              }}
            >
              {tagline}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
