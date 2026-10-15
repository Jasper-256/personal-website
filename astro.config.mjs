// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

/**
 * `astro dev` keeps its optimized dependencies (three, react, ...) in node_modules/.vite.
 * Any other Astro command that shares that folder can rewrite it underneath a running
 * dev server, which then answers with "504 Outdated Optimize Dep" and pages that import
 * npm packages (like the Three.js icosahedron) stop loading. Give every other command
 * its own cache so `npm run check` / `npm run build` are safe to run alongside `npm run dev`.
 * @type {import("astro").AstroIntegration}
 */
const isolateViteCache = {
  name: "isolate-vite-cache",
  hooks: {
    "astro:config:setup": ({ command, updateConfig }) => {
      if (command !== "dev") updateConfig({ vite: { cacheDir: `node_modules/.vite-${command}` } });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  integrations: [react(), isolateViteCache],
  output: "static",
  // Preserve spaces between inline elements across the Astro 7 upgrade.
  compressHTML: true,
  trailingSlash: "never",
  build: {
    format: "file",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  redirects: {
    "/projects/time/percent_time_raw": "/time/percent-time-raw",
  },
});
