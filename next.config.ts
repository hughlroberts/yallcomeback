import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
    unoptimized: false,
  },
  // Required for Dockerfile (Railway Docker / standalone server.js)
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/admin/tax",
        destination: "/help/taxes",
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
