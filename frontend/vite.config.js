import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.DJANGO_PROXY_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/media": "http://127.0.0.1:8000",
      "/ws": {
        target: (
          process.env.DJANGO_PROXY_URL || "http://127.0.0.1:8000"
        ).replace(/^http/, "ws"),
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.js"],
    css: false,
  },
});
