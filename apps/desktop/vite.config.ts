import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// @ts-expect-error `process` is injected by Node during configuration evaluation.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: "happy-dom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    globals: true,
    maxWorkers: 1,
    minWorkers: 1,
  },
}));
