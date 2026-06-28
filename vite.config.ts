import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// On GitHub Pages the app is served from https://hgoldstein95.github.io/wayfarer/,
// so production assets need the "/wayfarer/" base. Dev stays at "/".
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/wayfarer/" : "/",
  plugins: [react()],
  server: {
    port: 8000,
  },
}));
