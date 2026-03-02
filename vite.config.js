import { defineConfig } from "vite";

export default defineConfig({
  // Set to "/some-subfolder/" in .env.production if deploying under a subpath.
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("node_modules/three/examples/jsm/")) return "three-examples";
          if (id.includes("node_modules/three/")) return "three-core";
          return "vendor";
        },
      },
    },
  },
});
