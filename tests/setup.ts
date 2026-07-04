import "@testing-library/jest-dom";
import { vi } from "vitest";

// Supabase se mockea globalmente para no requerir credenciales reales en los tests.
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

// Variables de entorno de Vite usadas por los servicios.
vi.stubEnv("VITE_API_URL", "https://api.test.local");
