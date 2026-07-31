import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/features";

export const alt = `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

/**
 * iMessage / social link preview — brand seal + tagline (not a listing photo).
 */
export default async function OpenGraphImage() {
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
        {/* soft petal band */}
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
              width={200}
              height={200}
              alt=""
              style={{ borderRadius: 100 }}
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: 100,
                border: "4px solid #E8CE96",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#E8CE96",
                fontSize: 48,
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
