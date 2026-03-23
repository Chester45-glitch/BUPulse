import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isMobile = process.env.BUILD_TARGET === "mobile";

export default defineConfig({
  plugins: [react()],
  base: isMobile ? "./" : "/",
  build: {
    outDir: "dist",
    rollupOptions: {
      // Externalize Capacitor packages on web build so Rollup doesn't
      // try to bundle them — they only exist in the Android project
      external: isMobile ? [] : [
        "@capacitor/core",
        "@capacitor/app",
        "@capacitor/browser",
        "@capacitor/keyboard",
        "@capacitor/status-bar",
        "@capacitor/splash-screen",
      ],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
