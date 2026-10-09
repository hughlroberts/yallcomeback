import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [],
    unoptimized: false,
  },
  // Required for Dockerfile (Railway Docker / standalone server.js)
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/admin/tax",
        destination: "/admin/taxes",
        permanent: false,
      },
      {
        source: "/admin/business",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/admin/host",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/account/settings/host-profile",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/account/settings/notifications",
        destination: "/messages",
        permanent: false,
      },
      {
        source: "/ops/pricing",
        destination: "/ops/pricing-comps/intelligence",
        permanent: false,
      },
      {
        source: "/ops/pricing/:runId",
        destination: "/ops/pricing-comps/intelligence/:runId",
        permanent: false,
      },
      {
        source: "/ops/managers",
        destination: "/ops/settings/managers",
        permanent: false,
      },
      {
        source: "/ops/health",
        destination: "/ops/settings/health",
        permanent: false,
      },
      {
        source: "/ops/backups",
        destination: "/ops/settings/backups",
        permanent: false,
      },
      {
        source: "/ops/backups/download",
        destination: "/ops/settings/backups/download",
        permanent: false,
      },
      {
        source: "/ops/backups/file/:name",
        destination: "/ops/settings/backups/file/:name",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
