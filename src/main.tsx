// ──────────────────────────────────────────────────────────
//  Punto de entrada de la aplicación (entry point)
//  Inicializa React con TanStack Router y el árbol de rutas.
// ──────────────────────────────────────────────────────────

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

// Crea la instancia del router con el árbol generado
const router = getRouter();

// Registro de tipos para TypeScript — permite tipado fuerte en el router
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Monta la aplicación en el DOM con StrictMode para detectar efectos secundarios
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
