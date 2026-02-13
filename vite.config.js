import { defineConfig } from "vite";

export default defineConfig({
  // Set to "/some-subfolder/" in .env.production if deploying under a subpath.
  base: process.env.VITE_BASE_PATH || "/",
});
