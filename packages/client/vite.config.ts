import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: { port: 15173, strictPort: true },
  resolve: {
    preserveSymlinks: true, // helps with pnpm-linked deps
    alias: {
      "@client": path.resolve(__dirname, "./src")
    }
  },
  optimizeDeps: {
    include: ["@game/shared"]
  },
  build: {
    commonjsOptions: { include: [/node_modules/, /@game\/shared/] }
  }
});
