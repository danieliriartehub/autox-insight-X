const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? "https://autox-insight-backend-production.up.railway.app";

// ── Request / Response types ────────────────────────────────────────────────

export interface PredictRequest {
  /** Código exacto del repuesto (campo producto_id en Supabase) */
  codigo_repuesto: string;
  /** Mes objetivo 1–12 */
  mes: number;
  /** Kilometraje promedio del vehículo */
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
  /** Confianza 0–1 (0.87 si repuesto conocido, 0.45 si nuevo) */
  confianza: number;
  /** True si el repuesto estaba en los datos de entrenamiento */
  repuesto_conocido: boolean;
  /** MAE de referencia del modelo en unidades (~4.33) */
  mae_referencia: number;
}

// ── Service function ─────────────────────────────────────────────────────────

/**
 * Llama al endpoint POST /api/v1/ml/predict del backend Railway.
 */
export async function fetchPrediction(req: PredictRequest): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ml/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<PredictResponse>;
}

/**
 * Verifica que el backend ML esté activo y tenga el modelo cargado.
 */
export async function fetchMLStatus(): Promise<{
  modelo_cargado: boolean;
  version: string | null;
  repuestos_conocidos: number | null;
  mae_referencia: number;
}> {
  const res = await fetch(`${API_BASE}/api/v1/ml/status`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
