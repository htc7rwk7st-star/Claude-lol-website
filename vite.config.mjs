import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Im Dev-Modus leitet Vite /api an den Express-Server weiter
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${process.env.PORT || 3001}`,
    },
  },
});
