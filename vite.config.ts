// ── Configuración de Vite ─────────────────────────────────────────────────────
// Bundler principal del proyecto. Plugins: TanStack Router (rutas automáticas),
// React, Tailwind CSS v4 y resolución de paths vía tsconfig.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: ["@hookform/resolvers"],
  },
  ssr: {
    noExternal: ["@hookform/resolvers"],
  },
  server: {
    port: 8080,
  },
});
