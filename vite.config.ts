import path from "node:path";
import { defineConfig } from "vite";
import netlify from "@netlify/vite-plugin";

const arrowPackages = [
  "@arrow-js/core",
  "@arrow-js/framework",
  "@arrow-js/hydrate",
  "@arrow-js/ssr",
];

export default defineConfig(({ isSsrBuild }) => ({
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  optimizeDeps: {
    exclude: arrowPackages,
  },
  ssr: {
    external: ["jsdom"],
  },
  plugins: [netlify()],
  build: {
    outDir: isSsrBuild ? "dist/server" : "dist/client",
    emptyOutDir: !isSsrBuild,
    rollupOptions: {
      input: isSsrBuild
        ? path.resolve(__dirname, "src/entry-server.ts")
        : path.resolve(__dirname, "index.html"),
      output: isSsrBuild
        ? {
            entryFileNames: "entry-server.js",
          }
        : undefined,
    },
  },
}));
