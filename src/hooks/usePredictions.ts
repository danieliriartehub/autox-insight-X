import { useEffect, useState } from "react";
import { fetchPrediction, type PredictResponse } from "@/services/predict";

export type PredictMap = Record<string, PredictResponse>;

/**
 * Llama al backend Railway /api/v1/ml/predict para cada código de repuesto.
 * Los codigos deben ser los producto_id reales de Supabase (ot_repuesto.producto_id).
 */
export function usePredictions(
  codigos: string[],
  mes  = new Date().getMonth() + 1,
  anio = new Date().getFullYear(),
  km   = 50_000,
) {
  const [data,    setData]    = useState<PredictMap>({});
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Stable key — evita re-fetch en cada render
  const key = codigos.slice().sort().join(",");

  useEffect(() => {
    if (!codigos.length) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(
      codigos.map((c) =>
        fetchPrediction({ codigo_repuesto: c, mes, anio, km })
          .catch(() => null) // si falla un repuesto individual, no rompe el resto
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const map: PredictMap = {};
        results.forEach((r) => {
          if (r) map[r.codigo_repuesto] = r;
        });
        setData(map);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mes, anio, km]);

  return { data, loading, error };
}
