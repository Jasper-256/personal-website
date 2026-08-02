// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  output: "static",
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
