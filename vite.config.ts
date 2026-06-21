import { defineConfig } from "vite";
import netlify from "@netlify/vite-plugin";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "localhost+3-key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "localhost+3.pem")),
    },
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  plugins: [netlify()],
  build: {
    outDir: "dist/client",
  },
});
