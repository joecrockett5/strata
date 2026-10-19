import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiTarget = process.env.STRATA_API_URL ?? "http://localhost:5080";

// Everything the API serves is proxied so the editor and API share one origin
// (cookie auth + antiforgery, and a same-origin canvas iframe). Keys are anchored regexes:
// a bare "/s" prefix would also capture Vite's own "/src/..." module requests.
const proxied = ["^/api/", "^/media/", "^/site-assets/", "^/s/", "^/health$", "^/openapi/"];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: Number(process.env.STRATA_EDITOR_PORT ?? 5173),
    strictPort: true,
    proxy: Object.fromEntries(proxied.map((path) => [path, { target: apiTarget, changeOrigin: false }])),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
