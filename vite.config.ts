import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import tsconfigPaths from "vite-tsconfig-paths"
import svgr from "vite-plugin-svgr"
import checker from "vite-plugin-checker"
import { visualizer } from "rollup-plugin-visualizer"
import liveReload from "vite-plugin-live-reload"
import { watchAndRun } from "vite-plugin-watch-and-run"
import { loadEnv } from "vite"
import { goposApiPlugin } from "./src/server/plugin.ts"
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""))
  return {
  plugins: [
    goposApiPlugin(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    svgr(),
    checker({
      typescript: { tsconfigPath: "tsconfig.json" },
      eslint: {
        // Check only TS/TSX in source for faster feedback
        lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
        useFlatConfig: true,
      },
      overlay: { initialIsOpen: "error" },
    }),
    // Force reload when backend-like JSON data changes.
    liveReload("public/data/**/*.json", { alwaysReload: true, log: false }),
    watchAndRun([
      {
        name: "data-reload",
        watch: "public/data/**/*.json",
        delay: 200,
        run: (server) => {
          // Vite dev server websocket message for a full page reload.
          server.ws.send({ type: "full-reload" })
        },
      },
    ]),
    // enable visualizer only when you need bundle analysis
    visualizer({
      filename: "stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      plugins: [],
    },
  },
  }
})