// ── Setup global de pruebas ────────────────────────────────────────────────────
// Configuración compartida ejecutada antes de cada archivo de test.
// Mockea Supabase y las variables de entorno para que los tests
// no requieran credenciales reales ni conexión a backend.

import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock global de Supabase: evita necesidad de credenciales reales
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "fake-jwt-token" } },
      }),
    },
  },
  supabaseReady: true,
}));

// Variables de entorno de Vite usadas por los servicios bajo prueba
vi.stubEnv("VITE_API_URL", "https://api.test.local");
