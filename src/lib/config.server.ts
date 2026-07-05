// ── Configuración exclusiva del servidor ───────────────────────────────────────
// El sufijo .server.ts evita que Vite bundleé este archivo en el cliente.
// Los valores aquí NUNCA llegan al navegador.
// En Cloudflare Workers, process.env se resuelve en tiempo de request,
// por lo que las lecturas deben hacerse DENTRO de funciones/handlers.

import process from "node:process";

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    // Add server-only values here, e.g.:
    //   databaseUrl: process.env.DATABASE_URL,
    //   stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  };
}
