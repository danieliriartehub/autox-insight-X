// ──────────────────────────────────────────────────────────
//  Configuración del router TanStack
//  Crea el QueryClient y el router con el árbol de rutas.
//  Se exporta como función para lazy initialization.
// ──────────────────────────────────────────────────────────

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Cliente de React Query para caché de datos del servidor
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
