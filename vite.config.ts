import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import deno from "@deno/vite-plugin";

import "react";
import "react-dom";

export default defineConfig({
  root: "./client",
  server: {},
  plugins: [
    react(),
    deno(),
  ],
  optimizeDeps: {
    include: ["react/jsx-runtime"],
  },
  build: {
    outDir: "../server/dist",
    emptyOutDir: true,
  },
});
