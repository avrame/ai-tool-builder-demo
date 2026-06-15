import { defineConfig } from "vite";
import netlify from "@netlify/vite-plugin";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  plugins: [netlify()],
  build: {
    outDir: "dist/client",
  },
});
