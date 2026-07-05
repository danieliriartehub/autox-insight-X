// ── Configuración de Vitest ───────────────────────────────────────────────────
// Entorno jsdom para pruebas de componentes React.
// Resuelve el alias @/ → src/ y carga el setup global.

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/services/**", "src/lib/**", "src/hooks/**", "src/contexts/**"],
      exclude: ["src/lib/api/example.functions.ts", "src/lib/lovable-error-reporting.ts"],
      thresholds: {
        statements: 30,
        branches: 20,
        functions: 26,
        lines: 31,
      },
    },
  },
});
