// ── Servicios de IA / ML ──────────────────────────────────────────────────────
// Cliente HTTP para el backend Railway de AutoX Insight.
// Implementa los endpoints de predicción (RF-09), confianza (RF-10),
// estado del modelo (RF-11), reentrenamiento (RF-15) y OCs inteligentes (RF-12).

import { supabase } from "@/lib/supabase";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://autox-insight-backend-production.up.railway.app";

// ── Auth helper ─────────────────────────────────────────────────────────────
// Los endpoints protegidos (retrain, generar OC) exigen el JWT de Supabase.
// La sesión se obtiene de la cookie HttpOnly gestionada por Supabase Auth.
async function authHeaders(): Promise<Record<string, string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.auth as any).getSession();
  const token = data.session?.access_token;
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

// ── Predicción (RF-09 / RF-10) ──────────────────────────────────────────────

export interface PredictRequest {
  /** Código exacto del repuesto (campo producto_id en Supabase) */
  codigo_repuesto: string;
  /** Mes objetivo 1–12 */
  mes: number;
  /** Kilometraje promedio del vehículo (variable de contexto — RF-09) */
  km?: number;
  /** Año objetivo. Si se omite, el modelo usa el año más frecuente del entrenamiento */
  anio?: number;
}

export interface PredictResponse {
  codigo_repuesto: string;
  mes: number;
  anio: number;
  /** Unidades estimadas a demandar */
  cantidad_estimada: number;
  /** Confianza 0–1 CALCULADA en runtime (densidad histórica + magnitud) */
  confianza: number;
  /** True si confianza ≥ 80% (umbral de negocio — RF-10) */
  alta_confiabilidad: boolean;
  /** 'Alta Confiabilidad' | 'Confianza Media' | 'Extrapolación (baja confianza)' */
  etiqueta_confianza: string;
  /** True si el repuesto estaba en los datos de entrenamiento */
  repuesto_conocido: boolean;
  /** Nº de meses de historia del SKU (base de la confianza) */
  observaciones_historicas: number;
  /** MAE del modelo en unidades */
  mae_referencia: number;
  /** Explicación legible de la confianza */
  explicacion: string;
}

/** POST /api/v1/ml/predict — predicción puntual con confianza real. */
export async function fetchPrediction(req: PredictRequest): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ml/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<PredictResponse>;
}

// ── Estado del modelo (RF-11) ───────────────────────────────────────────────

export interface MLMetrics {
  mae: number | null;
  mape_global: number | null;
  wmape: number | null;
  mape_alta_rotacion: number | null;
  mae_alta_rotacion: number | null;
  wmape_gate: number | null;
  feature_importance: Record<string, number> | null;
}

export interface MLStatusResponse {
  modelo_cargado: boolean;
  algoritmo: string;
  modelo: string;
  version: string | null;
  repuestos_conocidos: number | null;
  entrenado_en: string | null;
  features: string[];
  umbral_alta_confiabilidad: number;
  metrics: MLMetrics | null;
}

/** GET /api/v1/ml/status — salud del modelo + métricas embebidas. */
export async function fetchMLStatus(): Promise<MLStatusResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ml/status`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Reentrenamiento (RF-15) ─────────────────────────────────────────────────

export interface RetrainResponse {
  promovido: boolean;
  forzado: boolean;
  version: string;
  entrenado_en: string;
  repuestos_conocidos: number;
  modelo_recargado: boolean;
  metrics: Record<string, unknown>;
  mensaje: string;
}

/** POST /api/v1/ml/retrain — reentrena con gate de calidad + hot-reload. */
export async function retrainModel(opts?: {
  correr_etl?: boolean;
  forzar_promocion?: boolean;
}): Promise<RetrainResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ml/retrain`, {
    method: "POST",
    headers: await authHeaders(),
    credentials: "include",
    body: JSON.stringify({
      correr_etl: opts?.correr_etl ?? false,
      forzar_promocion: opts?.forzar_promocion ?? false,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<RetrainResponse>;
}

// ── Órdenes de Compra Inteligentes (RF-12) ──────────────────────────────────

export interface PurchaseProposal {
  codigo_repuesto: string;
  descripcion: string | null;
  marca: string | null;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  demanda_ia: number;
  deficit: number;
  compra_sugerida: number;
  confianza_ia: number;
  etiqueta_confianza: string;
  repuesto_conocido: boolean;
  en_quiebre: boolean;
}

export interface SuggestionsResponse {
  resumen: {
    total_propuestas: number;
    en_quiebre: number;
    unidades_a_comprar: number;
    mes: number;
    anio: number | null;
  };
  propuestas: PurchaseProposal[];
}

/** GET /api/v1/purchase-orders/suggestions — propuestas de OC por IA. */
export async function fetchPurchaseSuggestions(params: {
  mes: number;
  anio?: number;
  km?: number;
  solo_quiebres?: boolean;
  limite?: number;
}): Promise<SuggestionsResponse> {
  const qs = new URLSearchParams();
  qs.set("mes", String(params.mes));
  if (params.anio) qs.set("anio", String(params.anio));
  if (params.km != null) qs.set("km", String(params.km));
  qs.set("solo_quiebres", String(params.solo_quiebres ?? true));
  qs.set("limite", String(params.limite ?? 50));

  const res = await fetch(`${API_BASE}/api/v1/purchase-orders/suggestions?${qs}`, {
    headers: await authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<SuggestionsResponse>;
}

export interface GenerateOCResponse {
  n_oc: string;
  items_insertados: number;
  detalle: unknown[];
  mensaje: string;
}

/** POST /api/v1/purchase-orders/generate — persiste la OC en orden_compra_detalle. */
export async function generatePurchaseOrder(
  items: { codigo_repuesto: string; compra_sugerida: number }[],
  observacion?: string,
): Promise<GenerateOCResponse> {
  const res = await fetch(`${API_BASE}/api/v1/purchase-orders/generate`, {
    method: "POST",
    headers: await authHeaders(),
    credentials: "include",
    body: JSON.stringify({ items, observacion }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<GenerateOCResponse>;
}
