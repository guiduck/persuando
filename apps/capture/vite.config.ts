import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  root: "src/renderer",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true
  },
  server: {
    host: "localhost",
    port: 5174,
    strictPort: true
  }
});
