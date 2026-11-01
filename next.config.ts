import type { NextConfig } from "next";

/**
 * Next hydration and JSON-LD need inline scripts. This still blocks
 * unexpected script hosts, plugins, and framing.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.openstreetmap.org",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [],
    unoptimized: false,
  },
  // Required for Dockerfile (Railway Docker / standalone server.js)
  output: "standalone",
  // Deterministic build ID from Railway git SHA (or falls back to Next.js default).
  // Helps keep server action IDs and caches stable across deploys.
  generateBuildId: async () => {
    if (process.env.RAILWAY_GIT_COMMIT_SHA) {
      return process.env.RAILWAY_GIT_COMMIT_SHA;
    }
    return null;
  },
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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
  async rewrites() {
    // Non-admin /ops (middleware sets x-ycb-ops-404 = OPS_NOT_FOUND_HEADER in
    // src/auth.config.ts and strips client copies) → an unknown path, so the
    // response is Next's stock 404 with no x-middleware-rewrite header.
    const opsNotFound = {
      has: [{ type: "header" as const, key: "x-ycb-ops-404", value: "1" }],
      destination: "/__ops-not-found",
    };
    return {
      beforeFiles: [
        { source: "/ops", ...opsNotFound },
        { source: "/ops/:path*", ...opsNotFound },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    // No /ops entries here: config redirects run before middleware and would
    // reveal /ops paths to non-admins. Legacy /ops aliases live as pages/routes
    // under src/app/ops, behind the platform-admin gate.
    return [
      // Apex → www, 301, every path; Next keeps the query string.
      // Runs before middleware. Only fires if apex DNS points at this app.
      {
        source: "/:path*",
        has: [{ type: "host", value: "yallcomeback.app" }],
        destination: "https://www.yallcomeback.app/:path*",
        statusCode: 301,
      },
      {
        source: "/admin/tax",
        destination: "/admin/taxes",
        permanent: false,
      },
      // Host shortcuts people type or old prefetches still hit (all were 404s).
      // Plan and billing live in account settings; domain and website in Brand.
      {
        source: "/admin/subscription",
        destination: "/account/settings/subscription",
        permanent: false,
      },
      {
        source: "/admin/billing",
        destination: "/account/settings/subscription",
        permanent: false,
      },
      {
        source: "/admin/domain",
        destination: "/admin/brand",
        permanent: false,
      },
      {
        source: "/admin/domains",
        destination: "/admin/brand",
        permanent: false,
      },
      {
        source: "/admin/website",
        destination: "/admin/brand",
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
