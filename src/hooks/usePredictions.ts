import { useEffect, useState } from "react";
import { fetchPrediction, type PredictResponse } from "@/services/predict";

export type PredictMap = Record<string, PredictResponse>;

export function usePredictions(
  codigos: string[],
  mes = new Date().getMonth() + 1,
  km = 50_000,
) {
  const [data, setData] = useState<PredictMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable key — avoids re-fetching on every render
  const key = codigos.slice().sort().join(",");

  useEffect(() => {
    if (!codigos.length) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(
      codigos.map((c) => fetchPrediction({ codigo_repuesto: c, mes, km })),
    )
      .then((results) => {
        if (cancelled) return;
        const map: PredictMap = {};
        results.forEach((r) => { map[r.codigo_repuesto] = r; });
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
  }, [key, mes, km]);

  return { data, loading, error };
}
