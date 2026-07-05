// ──────────────────────────────────────────────────────────
//  Configuración de TanStack Start (SSR)
//  Define middleware global de errores para capturar fallos
//  durante el renderizado del lado del servidor.
// ──────────────────────────────────────────────────────────

import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

// Middleware que envuelve cada request SSR con captura de errores
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Si el error tiene statusCode (ej. HTTPException de h3), lo re-lanzamos
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Instancia principal de Start con el middleware de error inyectado
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
