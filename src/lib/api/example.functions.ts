// ── Ejemplo de createServerFn (TanStack Start) ─────────────────────────────────
// Demostración de cómo crear funciones del lado del servidor que se invocan
// desde el cliente. El cuerpo del handler se ejecuta solo en el servidor.
// Usar este patrón en lugar de Edge Functions de Supabase para lógica server.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getServerConfig } from "../config.server";

export const getGreeting = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const config = getServerConfig();
    return {
      greeting: `Hello, ${data.name}!`,
      mode: config.nodeEnv ?? "unknown",
    };
  });
