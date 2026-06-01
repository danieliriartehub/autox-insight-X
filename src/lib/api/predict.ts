const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export interface PredictRequest {
  codigo_repuesto: string;
  mes: number;
  km: number;
  anio?: number;
  tipo_ot?: string;
  c_seguro?: number;
}

export interface PredictResponse {
  codigo_repuesto: string;
  cantidad_estimada: number;
  confianza: number; // 0–1
}

export async function fetchPrediction(req: PredictRequest): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<PredictResponse>;
}
