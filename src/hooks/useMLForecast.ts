// ── Hook: useMultiMonthForecast ───────────────────────────────────────────────
// Consulta el modelo ML para N meses futuros × M repuestos en paralelo.
// Genera el conjunto de datos para el gráfico de pronóstico trimestral
// en la página de IA Predictiva.

import { useEffect, useState } from "react";
import { fetchPrediction, type PredictResponse } from "@/services/predict";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ForecastEntry {
  codigo: string;
  mes: number;
  anio: number;
  pred: PredictResponse;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Llama al modelo ML para N meses futuros × M repuestos en paralelo.
 * Usado para el gráfico de pronóstico trimestral de la página de IA Predictiva.
 *
 * @param codigos     - Códigos de repuesto (producto_id de Supabase)
 * @param currentMes  - Mes actual (1-12)
 * @param currentAnio - Año actual
 * @param nMonths     - Cuántos meses futuros predecir (default 3)
 */
export function useMultiMonthForecast(
  codigos: string[],
  currentMes: number,
  currentAnio: number,
  nMonths = 3,
) {
  const [data, setData] = useState<ForecastEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable cache key
  const key = `${codigos.slice().sort().join(",")}-${currentMes}-${currentAnio}-${nMonths}`;

  useEffect(() => {
    if (!codigos.length) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Genera los meses futuros: empieza en el MES SIGUIENTE al actual
    const months = Array.from({ length: nMonths }, (_, i) => {
      const total = currentMes + i + 1; // +1 → primer mes es el SIGUIENTE
      const mes = ((total - 1) % 12) + 1;
      const anio = currentAnio + Math.floor((total - 1) / 12);
      return { mes, anio };
    });

    // Una llamada por cada (codigo × mes)
    Promise.all(
      codigos.slice(0, 7).flatMap((codigo) =>
        months.map(({ mes, anio }) =>
          fetchPrediction({ codigo_repuesto: codigo, mes, anio, km: 50_000 })
            .then((pred) => ({ codigo, mes, anio, pred }) as ForecastEntry)
            .catch(() => null),
        ),
      ),
    )
      .then((results) => {
        if (!cancelled) setData(results.filter(Boolean) as ForecastEntry[]);
      })
      .catch(() => {
        if (!cancelled) setError("Error en forecast multi-mes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error };
}
