import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const API_TARGET = process.env.VITE_API_TARGET ?? "http://127.0.0.1:4000";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // The force simulation and QR encoder are only needed once a session
          // is on screen, so keeping them out of the entry chunk gets the join
          // page painting sooner on a phone with one bar of signal.
          viz: ["d3-force"],
          qr: ["qrcode"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        // Server-Sent Events must not be buffered by the dev proxy.
        ws: false,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform";
            }
          });
        },
      },
    },
  },
  preview: {
    port: 5173,
  },
});
