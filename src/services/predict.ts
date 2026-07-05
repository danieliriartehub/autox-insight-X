import { supabase } from "@/lib/supabase";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://autox-insight-backend-production.up.railway.app";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export interface PredictRequest {
  codigo_repuesto: string;
  mes: number;
  km?: number;
  anio?: number;
}

export interface PredictResponse {
  codigo_repuesto: string;
  mes: number;
  anio: number;
  cantidad_estimada: number;
  confianza: number;
  confianza_lower: number;
  confianza_upper: number;
  alta_confiabilidad: boolean;
  etiqueta_confianza: string;
  repuesto_conocido: boolean;
  observaciones_historicas: number;
  mae_referencia: number;
  feature_importance: Record<string, number>;
  explicacion: string;
}

export async function fetchPrediction(req: PredictRequest): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ml/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<PredictResponse>;
}

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

export async function fetchMLStatus(): Promise<MLStatusResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ml/status`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

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
