/**
 * PRUEBAS UNITARIAS — Servicios de IA (predict.ts).
 *
 * Prueban la construcción de requests y el parseo de respuestas de forma
 * aislada, con `fetch` mockeado (sin backend real).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchPrediction, fetchMLStatus, retrainModel,
  fetchPurchaseSuggestions, generatePurchaseOrder,
} from "@/services/predict";

const g = globalThis as unknown as { fetch: ReturnType<typeof vi.fn> };

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  g.fetch = vi.fn().mockResolvedValue({
    ok, status,
    json: async () => body,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchPrediction (RF-09/RF-10)", () => {
  it("envía POST con el payload correcto y devuelve la predicción", async () => {
    const fake = {
      codigo_repuesto: "01001-01001", mes: 6, anio: 2026,
      cantidad_estimada: 41, confianza: 0.95, alta_confiabilidad: true,
      etiqueta_confianza: "Alta Confiabilidad", repuesto_conocido: true,
      observaciones_historicas: 25, mae_referencia: 2.54, explicacion: "…",
    };
    mockFetchOnce(fake);
    const res = await fetchPrediction({ codigo_repuesto: "01001-01001", mes: 6, anio: 2026, km: 50000 });

    expect(g.fetch).toHaveBeenCalledOnce();
    const [url, opts] = g.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/ml/predict");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({ codigo_repuesto: "01001-01001", mes: 6, km: 50000 });
    expect(res.alta_confiabilidad).toBe(true);
    expect(res.etiqueta_confianza).toBe("Alta Confiabilidad");
  });

  it("lanza error si el backend responde no-OK", async () => {
    mockFetchOnce({}, false, 503);
    await expect(fetchPrediction({ codigo_repuesto: "X", mes: 6 })).rejects.toThrow("503");
  });
});

describe("fetchMLStatus (RF-11)", () => {
  it("devuelve el estado del modelo con métricas", async () => {
    mockFetchOnce({
      modelo_cargado: true, algoritmo: "XGBoost Regressor", version: "3.0",
      repuestos_conocidos: 600, metrics: { wmape: 33.54, mape_alta_rotacion: 27.02, mae: 2.54 },
    });
    const res = await fetchMLStatus();
    expect(res.modelo_cargado).toBe(true);
    expect(res.metrics?.wmape).toBe(33.54);
  });
});

describe("retrainModel (RF-15)", () => {
  it("envía el JWT en el header Authorization", async () => {
    mockFetchOnce({ promovido: true, forzado: false, version: "3.0", entrenado_en: "", repuestos_conocidos: 600, modelo_recargado: true, metrics: {}, mensaje: "ok" });
    await retrainModel({ correr_etl: false });
    const [, opts] = g.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer fake-jwt-token");
    expect(JSON.parse(opts.body)).toMatchObject({ correr_etl: false });
  });

  it("propaga el detalle de error del backend", async () => {
    g.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ detail: "gate falló" }) });
    await expect(retrainModel()).rejects.toThrow("gate falló");
  });
});

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
});

describe("generatePurchaseOrder (RF-12)", () => {
  it("envía los items y la observación con autenticación", async () => {
    mockFetchOnce({ n_oc: "OC-IA-20260703-ABC123", items_insertados: 2, detalle: [], mensaje: "ok" });
    const res = await generatePurchaseOrder(
      [{ codigo_repuesto: "A", compra_sugerida: 5 }, { codigo_repuesto: "B", compra_sugerida: 3 }],
      "OC de prueba",
    );
    const [url, opts] = g.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/purchase-orders/generate");
    expect(opts.headers.Authorization).toBe("Bearer fake-jwt-token");
    expect(JSON.parse(opts.body).items).toHaveLength(2);
    expect(res.n_oc).toMatch(/^OC-IA-/);
  });
});
