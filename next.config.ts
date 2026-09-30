import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a0.muscache.com", pathname: "/**" },
      { protocol: "https", hostname: "muscache.com", pathname: "/**" },
    ],
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
    ];
  },
};

export default nextConfig;
