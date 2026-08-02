export { default, size, contentType, alt } from "./opengraph-image";

// Must be local literals — Next cannot statically parse re-exported config.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
