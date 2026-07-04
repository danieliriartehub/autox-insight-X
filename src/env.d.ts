// ──────────────────────────────────────────────────────────
//  MEJORA: Declaraciones de tipos para dependencias sin tipos
//  RAZÓN: @tanstack/router-plugin/vite no tiene tipos nativos.
//  IMPACTO: Zero errores TS en vite.config.ts.
// ──────────────────────────────────────────────────────────

/// <reference types="vite/client" />

declare module "@tanstack/router-plugin/vite" {
  import { Plugin } from "vite";
  interface TanStackRouterViteOptions {
    routesDirectory?: string;
    generatedRouteTree?: string;
  }
  export function TanStackRouterVite(options?: TanStackRouterViteOptions): Plugin;
}
