import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://build:build@127.0.0.1:5432/build",
      NEXT_PUBLIC_SITE_URL: "https://www.yallcomeback.app",
      AUTH_URL: "https://www.yallcomeback.app",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
