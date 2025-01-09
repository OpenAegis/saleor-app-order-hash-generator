import { defineConfig } from "vite";
import reactPlugin from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      reactPlugin(),
    ],
  };
});
