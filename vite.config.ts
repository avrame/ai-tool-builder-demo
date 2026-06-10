import { defineConfig } from "vite";
import netlify from "@netlify/vite-plugin";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  plugins: [netlify()],
  build: {
    outDir: "dist/client",
  },
});
