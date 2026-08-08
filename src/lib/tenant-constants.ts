/**
 * Tenant request header name — shared by middleware (Edge) and server.
 * Keep this file free of auth/db imports so middleware stays lean.
 */
export const TENANT_SLUG_HEADER = "x-tenant-slug";
