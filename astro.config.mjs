// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
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
