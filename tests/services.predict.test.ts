// ── Pruebas unitarias de servicios IA ─────────────────────────────────────────
// Verifica la construcción de requests HTTP y el parseo de respuestas
// de predict.ts usando fetch mockeado (sin backend real).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchPrediction,
  fetchMLStatus,
  retrainModel,
  fetchPurchaseSuggestions,
  generatePurchaseOrder,
} from "@/services/predict";

const g = globalThis as unknown as { fetch: ReturnType<typeof vi.fn> };

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  g.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
}

function mockFetchError(body: unknown, status = 503) {
  g.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => body,
  });
}

function mockFetchNetworkError() {
  g.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── fetchPrediction (RF-09/RF-10) ─────────────────────────────────────────────

describe("fetchPrediction (RF-09/RF-10)", () => {
  it("envía POST con el payload correcto y devuelve la predicción", async () => {
    const fake = {
      codigo_repuesto: "01001-01001",
      mes: 6,
      anio: 2026,
      cantidad_estimada: 41,
      confianza: 0.95,
      alta_confiabilidad: true,
      etiqueta_confianza: "Alta Confiabilidad",
      repuesto_conocido: true,
      observaciones_historicas: 25,
      mae_referencia: 2.54,
      explicacion: "…",
    };
    mockFetchOnce(fake);
    const res = await fetchPrediction({
      codigo_repuesto: "01001-01001",
      mes: 6,
      anio: 2026,
      km: 50000,
    });

    expect(g.fetch).toHaveBeenCalledOnce();
    const [url, opts] = g.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/ml/predict");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({
      codigo_repuesto: "01001-01001",
      mes: 6,
      km: 50000,
    });
    expect(res.alta_confiabilidad).toBe(true);
    expect(res.etiqueta_confianza).toBe("Alta Confiabilidad");
  });

  it("lanza error si el backend responde no-OK", async () => {
    mockFetchOnce({}, false, 503);
    await expect(fetchPrediction({ codigo_repuesto: "X", mes: 6 })).rejects.toThrow("503");
  });

  it("rechaza con network error si fetch falla", async () => {
    mockFetchNetworkError();
    await expect(fetchPrediction({ codigo_repuesto: "X", mes: 6 })).rejects.toThrow(
      "Failed to fetch",
    );
  });

  it("maneja respuesta vacía (objeto JSON mínimo)", async () => {
    mockFetchOnce({});
    const res = await fetchPrediction({ codigo_repuesto: "A", mes: 1 });
    expect(res).toEqual({});
  });
});

// ── fetchMLStatus (RF-11) ─────────────────────────────────────────────────────

describe("fetchMLStatus (RF-11)", () => {
  it("devuelve el estado del modelo con métricas", async () => {
    mockFetchOnce({
      modelo_cargado: true,
      algoritmo: "XGBoost Regressor",
      version: "3.0",
      repuestos_conocidos: 600,
      metrics: { wmape: 33.54, mape_alta_rotacion: 27.02, mae: 2.54 },
    });
    const res = await fetchMLStatus();
    expect(res.modelo_cargado).toBe(true);
    expect(res.metrics?.wmape).toBe(33.54);
  });

  it("lanza error si el backend responde 500", async () => {
    mockFetchError({}, 500);
    await expect(fetchMLStatus()).rejects.toThrow("500");
  });

  it("lanza error si hay error de red", async () => {
    mockFetchNetworkError();
    await expect(fetchMLStatus()).rejects.toThrow("Failed to fetch");
  });
});

// ── retrainModel (RF-15) ──────────────────────────────────────────────────────

describe("retrainModel (RF-15)", () => {
  it("envía el JWT en el header Authorization", async () => {
    mockFetchOnce({
      promovido: true,
      forzado: false,
      version: "3.0",
      entrenado_en: "",
      repuestos_conocidos: 600,
      modelo_recargado: true,
      metrics: {},
      mensaje: "ok",
    });
    await retrainModel({ correr_etl: false });
    const [, opts] = g.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer fake-jwt-token");
    expect(JSON.parse(opts.body)).toMatchObject({ correr_etl: false });
  });

  it("propaga el detalle de error del backend", async () => {
    g.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "gate falló" }),
    });
    await expect(retrainModel()).rejects.toThrow("gate falló");
  });

  it("usa fallback genérico si el body de error no tiene detail", async () => {
    g.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({}),
    });
    await expect(retrainModel()).rejects.toThrow("API error 422");
  });

  it("usa fallback si el body de error no es JSON", async () => {
    g.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    await expect(retrainModel()).rejects.toThrow("API error 500");
  });

  it("envía forzar_promocion cuando se pasa", async () => {
    mockFetchOnce({
      promovido: true,
      forzado: true,
      version: "3.0",
      entrenado_en: "",
      repuestos_conocidos: 600,
      modelo_recargado: true,
      metrics: {},
      mensaje: "ok",
    });
    await retrainModel({ correr_etl: true, forzar_promocion: true });
    const [, opts] = g.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toMatchObject({
      correr_etl: true,
      forzar_promocion: true,
    });
  });

  it("usa valores por defecto (false) cuando no se pasan opciones", async () => {
    mockFetchOnce({
      promovido: true,
      forzado: false,
      version: "3.0",
      entrenado_en: "",
      repuestos_conocidos: 600,
      modelo_recargado: true,
      metrics: {},
      mensaje: "ok",
    });
    await retrainModel();
    const [, opts] = g.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toMatchObject({
      correr_etl: false,
      forzar_promocion: false,
    });
  });
});

// ── fetchPurchaseSuggestions (RF-12) ───────────────────────────────────────────

describe("fetchPurchaseSuggestions (RF-12)", () => {
  it("construye la query string con mes/km/solo_quiebres", async () => {
    mockFetchOnce({ resumen: {}, propuestas: [] });
    await fetchPurchaseSuggestions({ mes: 6, km: 50000, solo_quiebres: true, limite: 10 });
    const [url] = g.fetch.mock.calls[0];
    expect(url).toContain("mes=6");
    expect(url).toContain("km=50000");
    expect(url).toContain("solo_quiebres=true");
    expect(url).toContain("limite=10");
  });

  it("incluye anio si se pasa", async () => {
    mockFetchOnce({ resumen: {}, propuestas: [] });
    await fetchPurchaseSuggestions({ mes: 6, anio: 2026 });
    const [url] = g.fetch.mock.calls[0];
    expect(url).toContain("anio=2026");
  });

  it("usa valores por defecto para solo_quiebres y limite", async () => {
    mockFetchOnce({ resumen: {}, propuestas: [] });
    await fetchPurchaseSuggestions({ mes: 3 });
    const [url] = g.fetch.mock.calls[0];
    expect(url).toContain("solo_quiebres=true");
    expect(url).toContain("limite=50");
  });

  it("incluye JWT en el header", async () => {
    mockFetchOnce({ resumen: {}, propuestas: [] });
    await fetchPurchaseSuggestions({ mes: 6 });
    const [, opts] = g.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer fake-jwt-token");
  });

  it("lanza error si el backend falla", async () => {
    mockFetchError({}, 400);
    await expect(fetchPurchaseSuggestions({ mes: 6 })).rejects.toThrow("400");
  });
});

// ── generatePurchaseOrder (RF-12) ─────────────────────────────────────────────

describe("generatePurchaseOrder (RF-12)", () => {
  it("envía los items y la observación con autenticación", async () => {
    mockFetchOnce({
      n_oc: "OC-IA-20260703-ABC123",
      items_insertados: 2,
      detalle: [],
      mensaje: "ok",
    });
    const res = await generatePurchaseOrder(
      [
        { codigo_repuesto: "A", compra_sugerida: 5 },
        { codigo_repuesto: "B", compra_sugerida: 3 },
      ],
      "OC de prueba",
    );
    const [url, opts] = g.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/purchase-orders/generate");
    expect(opts.headers.Authorization).toBe("Bearer fake-jwt-token");
    expect(JSON.parse(opts.body).items).toHaveLength(2);
    expect(res.n_oc).toMatch(/^OC-IA-/);
  });

  it("funciona sin observación", async () => {
    mockFetchOnce({
      n_oc: "OC-IA-20260703-DEF456",
      items_insertados: 1,
      detalle: [],
      mensaje: "ok",
    });
    await generatePurchaseOrder([{ codigo_repuesto: "A", compra_sugerida: 5 }]);
    const [, opts] = g.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).not.toHaveProperty("observacion");
  });

  it("propaga error del backend", async () => {
    g.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: "stock insuficiente" }),
    });
    await expect(
      generatePurchaseOrder([{ codigo_repuesto: "A", compra_sugerida: 999 }]),
    ).rejects.toThrow("stock insuficiente");
  });
});
