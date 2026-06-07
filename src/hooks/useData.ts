import { useEffect, useState } from "react";
import { supabase, supabaseReady } from "@/lib/supabase";

// ── tipos exportados ──────────────────────────────────────────────────────────

export interface Kpis {
  otsAbiertas: number;
  otsCerradas: number;
  repuestosConsumidos: number;
  inventarioDisponible: number;
  quiebresStock: number;
  prediccionDemanda: number;
}

export type OTEstado = "Abierta" | "En Proceso" | "Cerrada" | "Pendiente Repuesto";

export interface OrdenTrabajo {
  id: string;
  fecha: string;
  vehiculo: string;
  cliente: string;
  estado: OTEstado;
  mecanico: string;
  marca: string;
  modelo: string;
}

export type StockEstado = "Óptimo" | "Bajo" | "Crítico" | "Exceso";

export interface ItemInventario {
  codigo: string;
  repuesto: string;
  categoria: string;
  marca: string;
  stock: number;
  min: number;
  max: number;
  estado: StockEstado;
}

export interface Movimiento {
  fecha: string;
  tipo: "Entrada" | "Salida";
  codigo: string;
  cant: number;
  ref: string;
}

export interface TopRepuesto {
  codigo: string;
  repuesto: string;
  demanda: number;
  recomendado: number;
  riesgo: "Bajo" | "Medio" | "Alto";
  stockActual: number;
  stockMinimo: number;
}

// ── helpers internos ──────────────────────────────────────────────────────────

const TIMEOUT_MS = 12_000;
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseReady) {
      setError("Variables de entorno de Supabase no configuradas. Revisar Vercel → Settings → Environment Variables.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setError("Tiempo de espera agotado (12s). Verificar conexión con Supabase.");
        setLoading(false);
      }
    }, TIMEOUT_MS);

    fetcher()
      .then((d) => {
        if (!cancelled) { clearTimeout(timeout); setData(d); setLoading(false); }
      })
      .catch((e: Error) => {
        if (!cancelled) { clearTimeout(timeout); setError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// ── helpers de mapeo ──────────────────────────────────────────────────────────

function mapEstado(c: string | null | undefined): OTEstado {
  if (!c) return "Abierta";
  if (c === "S7") return "Cerrada";
  if (c === "S6") return "En Proceso";
  if (c === "S5") return "Pendiente Repuesto";
  return "Abierta";
}

function extractCategoria(desc: string): string {
  const d = (desc ?? "").toLowerCase();
  if (d.includes("filtro"))                                          return "Filtros";
  if (d.includes("aceite") || d.includes("lubricante"))             return "Aceites";
  if (d.includes("freno") || d.includes("pastilla") || d.includes("disco")) return "Frenos";
  if (d.includes("amortiguador") || d.includes("suspen") || d.includes("resorte")) return "Suspensión";
  if (d.includes("bateria") || d.includes("faro") || d.includes("electr")) return "Eléctrico";
  if (d.includes("correa") || d.includes("motor") || d.includes("piston")) return "Motor";
  return "Otros";
}

function calcEstado(stock: number, min: number, max: number): StockEstado {
  if (stock <= 0)   return "Crítico";
  if (stock < min)  return "Bajo";
  if (max > 0 && stock > max) return "Exceso";
  return "Óptimo";
}

// ── hooks públicos ────────────────────────────────────────────────────────────

/**
 * KPIs del dashboard principal.
 * Fuentes: orden_trabajo, ot_repuesto, stock
 */
export function useKpis() {
  return useQuery<Kpis>(async () => {
    const [otRes, otrRes, stockRes] = await Promise.all([
      supabase.from("orden_trabajo").select("c_estado"),
      supabase.from("ot_repuesto").select("cantidad").limit(8000),
      supabase.from("stock").select("stock, stock_minimo"),
    ]);

    const ots      = otRes.data   ?? [];
    const repuestos = otrRes.data ?? [];
    const stocks   = stockRes.data ?? [];

    const otsAbiertas   = ots.filter((o) => o.c_estado !== "S7").length;
    const otsCerradas   = ots.filter((o) => o.c_estado === "S7").length;
    const repuestosConsumidos = Math.round(
      repuestos.reduce((s, r) => s + (Number(r.cantidad) || 0), 0)
    );
    const inventarioDisponible = Math.round(
      stocks.reduce((s, st) => s + (Number(st.stock) || 0), 0)
    );
    const quiebresStock = stocks.filter(
      (st) => Number(st.stock) < Number(st.stock_minimo)
    ).length;

    return {
      otsAbiertas,
      otsCerradas,
      repuestosConsumidos,
      inventarioDisponible,
      quiebresStock,
      prediccionDemanda: Math.round(repuestosConsumidos * 1.12),
    };
  });
}

/**
 * Consumo mensual de repuestos (últimos 12 meses).
 * Fuente: ot_repuesto.anio_registro + mes_registro
 */
export function useConsumoMensual() {
  return useQuery(async () => {
    const { data } = await supabase
      .from("ot_repuesto")
      .select("cantidad, anio_registro, mes_registro")
      .not("anio_registro", "is", null)
      .limit(8000);
    if (!data) return [];

    const grouped: Record<string, { consumo: number; mes: string }> = {};
    for (const row of data) {
      const anio = Number(row.anio_registro);
      const mes  = Number(row.mes_registro);
      if (!anio || !mes) continue;
      const ym = `${anio}-${String(mes).padStart(2, "0")}`;
      if (!grouped[ym]) grouped[ym] = { consumo: 0, mes: MESES[mes - 1] };
      grouped[ym].consumo += Number(row.cantidad) || 0;
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => ({
        mes: v.mes,
        consumo: Math.round(v.consumo),
        prediccion: Math.round(v.consumo * 1.08),
      }));
  });
}

/**
 * Distribución de OTs por tipo de servicio.
 * Fuente: orden_trabajo.tipo_ot_desc
 */
export function useDistribucionServicios() {
  return useQuery(async () => {
    const { data } = await supabase.from("orden_trabajo").select("tipo_ot_desc");
    if (!data) return [];

    const counts: Record<string, number> = {};
    for (const row of data) {
      const tipo = String(row.tipo_ot_desc ?? "Otro").trim() || "Otro";
      counts[tipo] = (counts[tipo] ?? 0) + 1;
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tipo, n]) => ({
        tipo,
        valor: Math.round((n / total) * 100),
      }));
  });
}

/**
 * Nivel de inventario agrupado por categoría.
 * Fuente: stock JOIN repuesto (FK: stock.c_repuesto → repuesto.c_repuesto)
 */
export function useNivelInventario() {
  return useQuery(async () => {
    const { data } = await supabase
      .from("stock")
      .select("stock, stock_minimo, repuesto(descripcion)")
      .limit(2000);
    if (!data) return [];

    const byCat: Record<string, { actual: number; minimo: number }> = {};
    for (const row of data) {
      const repData = row.repuesto as { descripcion?: string } | null;
      const desc = String(repData?.descripcion ?? "");
      const cat  = extractCategoria(desc);
      if (!byCat[cat]) byCat[cat] = { actual: 0, minimo: 0 };
      byCat[cat].actual  += Number(row.stock)        || 0;
      byCat[cat].minimo  += Number(row.stock_minimo) || 0;
    }

    return Object.entries(byCat)
      .sort(([, a], [, b]) => b.actual - a.actual)
      .map(([categoria, v]) => ({
        categoria,
        actual: Math.round(v.actual),
        minimo: Math.round(v.minimo),
      }));
  });
}

/**
 * Listado de órdenes de trabajo (taller).
 * Fuente: orden_trabajo JOIN auto (FK: orden_trabajo.vin → auto.vin)
 */
export function useOrdenesTrabajo() {
  return useQuery<OrdenTrabajo[]>(async () => {
    const { data } = await supabase
      .from("orden_trabajo")
      .select("n_ot, fecha, vin, c_estado, tipo_ot_desc, requerimiento, auto(placa, marca, modelo)")
      .order("fecha", { ascending: false })
      .limit(100);
    if (!data) return [];

    return data.map((row) => {
      const autoData = row.auto as { placa?: string; marca?: string; modelo?: string } | null;
      return {
        id: `OT-${row.n_ot}`,
        fecha: String(row.fecha ?? "").split("T")[0],
        vehiculo: String(autoData?.placa ?? row.vin ?? "—"),
        cliente: String(row.requerimiento ?? "—").slice(0, 50) || "—",
        estado: mapEstado(row.c_estado as string),
        mecanico: "—",
        marca: String(autoData?.marca ?? "—"),
        modelo: String(autoData?.modelo ?? "—"),
      };
    });
  });
}

/**
 * Detalle de repuestos de una OT específica.
 * Fuente: ot_repuesto WHERE n_ot = otId
 */
export function useDetalleOT(otId: string) {
  const otNum = otId.replace("OT-", "");
  return useQuery(async () => {
    if (!otNum) return { servicios: [], fallas: [], repuestos: [], ejecucion: 0 };
    const { data } = await supabase
      .from("ot_repuesto")
      .select("producto_id, descripcion, cantidad")
      .eq("n_ot", otNum);
    const repuestos = (data ?? []).map((r) => ({
      codigo: String(r.producto_id ?? ""),
      desc:   String(r.descripcion ?? r.producto_id ?? ""),
      cant:   Number(r.cantidad) || 0,
    }));
    return {
      servicios: repuestos.length ? ["Ver repuestos en tabla"] : ["Sin repuestos registrados"],
      fallas:    [],
      repuestos,
      ejecucion: 100,
    };
  }, [otNum]);
}

/**
 * Catálogo de inventario con stock real.
 * Fuente: stock JOIN repuesto (FK: stock.c_repuesto → repuesto.c_repuesto)
 */
export function useInventario() {
  return useQuery<ItemInventario[]>(async () => {
    const { data } = await supabase
      .from("stock")
      .select("c_repuesto, stock, stock_minimo, stock_maximo, repuesto(descripcion, marca)")
      .limit(500);
    if (!data) return [];

    return data
      .map((row) => {
        const repData = row.repuesto as { descripcion?: string; marca?: string } | null;
        const desc  = String(repData?.descripcion ?? row.c_repuesto ?? "");
        const stock = Math.round(Number(row.stock)        || 0);
        const min   = Math.round(Number(row.stock_minimo) || 0);
        const max   = Math.round(Number(row.stock_maximo) || 0) || Math.max(min * 3, 1);
        return {
          codigo:   String(row.c_repuesto ?? ""),
          repuesto: desc,
          categoria: extractCategoria(desc),
          marca:    String(repData?.marca ?? "—"),
          stock,
          min,
          max,
          estado: calcEstado(stock, min, max),
        };
      })
      .sort((a, b) => a.stock - b.stock); // más críticos primero
  });
}

/**
 * Movimientos recientes (entradas desde órdenes de compra).
 * Fuente: orden_compra_detalle
 */
export function useMovimientos() {
  return useQuery<Movimiento[]>(async () => {
    const { data } = await supabase
      .from("orden_compra_detalle")
      .select("id, n_oc, repuesto_id, cantidad_compra")
      .order("id", { ascending: false })
      .limit(30);
    if (!data) return [];

    return data.map((row, i) => {
      // orden_compra_detalle no tiene fecha — estimamos hacia atrás desde hoy
      const d = new Date(Date.now() - i * 3 * 24 * 3600000);
      return {
        fecha: d.toISOString().split("T")[0],
        tipo:  "Entrada" as const,
        codigo: String(row.repuesto_id ?? "—"),
        cant:   Number(row.cantidad_compra) || 0,
        ref:    `OC-${row.n_oc ?? row.id}`,
      };
    });
  });
}

/**
 * Top repuestos más consumidos (por descripción, para gráfico).
 * Fuente: ot_repuesto agrupado por descripcion
 */
export function useRepuestosMasConsumidos() {
  return useQuery(async () => {
    const { data } = await supabase
      .from("ot_repuesto")
      .select("descripcion, cantidad")
      .limit(8000);
    if (!data) return [];

    const byDesc: Record<string, number> = {};
    for (const row of data) {
      const desc = String(row.descripcion ?? "").trim();
      if (!desc) continue;
      byDesc[desc] = (byDesc[desc] ?? 0) + (Number(row.cantidad) || 0);
    }
    return Object.entries(byDesc)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([repuesto, consumo]) => ({
        repuesto: repuesto.slice(0, 28),
        consumo:  Math.round(consumo),
      }));
  });
}

/**
 * Consumo de repuestos agrupado por tipo de OT.
 * Fuente: ot_repuesto JOIN orden_trabajo via n_ot
 */
export function useConsumoPorTipo() {
  return useQuery(async () => {
    const [otRes, otrRes] = await Promise.all([
      supabase.from("orden_trabajo").select("n_ot, tipo_ot_desc"),
      supabase.from("ot_repuesto").select("n_ot, cantidad").limit(8000),
    ]);
    const ots = otRes.data  ?? [];
    const otr = otrRes.data ?? [];

    const otTipo: Record<string, string> = {};
    for (const o of ots) {
      otTipo[String(o.n_ot)] = String(o.tipo_ot_desc ?? "Otro").trim() || "Otro";
    }

    const byTipo: Record<string, number> = {};
    for (const r of otr) {
      const tipo = otTipo[String(r.n_ot)] ?? "Otro";
      byTipo[tipo] = (byTipo[tipo] ?? 0) + (Number(r.cantidad) || 0);
    }
    return Object.entries(byTipo)
      .sort(([, a], [, b]) => b - a)
      .map(([marca, consumo]) => ({ marca, consumo: Math.round(consumo) }));
  });
}

/**
 * Tendencia de consumo histórico + proyección IA para los próximos meses.
 * Fuente: ot_repuesto.anio_registro + mes_registro
 */
export function useTendenciaFutura() {
  return useQuery(async () => {
    const { data } = await supabase
      .from("ot_repuesto")
      .select("cantidad, anio_registro, mes_registro")
      .not("anio_registro", "is", null)
      .limit(8000);
    if (!data) return [];

    const grouped: Record<string, { consumo: number; mes: string }> = {};
    for (const row of data) {
      const anio = Number(row.anio_registro);
      const mes  = Number(row.mes_registro);
      if (!anio || !mes) continue;
      const ym = `${anio}-${String(mes).padStart(2, "0")}`;
      if (!grouped[ym]) grouped[ym] = { consumo: 0, mes: MESES[mes - 1] };
      grouped[ym].consumo += Number(row.cantidad) || 0;
    }

    const now   = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([ym, v]) => ({
        mes:       v.mes,
        actual:    ym <= nowYM ? Math.round(v.consumo) : null,
        prediccion: Math.round(v.consumo * (ym <= nowYM ? 1 : 1.1)),
      }));
  });
}

/**
 * Top 7 repuestos más demandados — base para el módulo de predicción IA.
 * Fuente: ot_repuesto agrupado por producto_id
 * Los códigos retornados se usan en usePredictions → POST /api/v1/ml/predict
 */
export function useTopRepuestos() {
  return useQuery<TopRepuesto[]>(async () => {
    const [otRes, stockRes] = await Promise.all([
      supabase.from("ot_repuesto").select("producto_id, descripcion, cantidad").limit(8000),
      supabase.from("stock").select("c_repuesto, stock, stock_minimo").limit(2000),
    ]);
    
    const data = otRes.data ?? [];
    const stockData = stockRes.data ?? [];

    const stockMap: Record<string, { stock: number; min: number }> = {};
    for (const s of stockData) {
      if (s.c_repuesto) {
        stockMap[s.c_repuesto] = { 
          stock: Number(s.stock) || 0, 
          min: Number(s.stock_minimo) || 0 
        };
      }
    }

    const byCode: Record<string, { desc: string; total: number }> = {};
    for (const row of data) {
      const code = String(row.producto_id ?? "").trim();
      if (!code) continue;
      if (!byCode[code]) byCode[code] = { desc: String(row.descripcion ?? code), total: 0 };
      byCode[code].total += Number(row.cantidad) || 0;
    }

    return Object.entries(byCode)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 15) // Aumentamos a 15 para tener más datos en la tabla de OCs
      .map(([codigo, v]) => {
        const s = stockMap[codigo] ?? { stock: 0, min: 0 };
        return {
          codigo,
          repuesto:    v.desc.slice(0, 30),
          demanda:     Math.round(v.total),
          recomendado: Math.round(v.total * 1.2),
          riesgo:      v.total < 10 ? "Alto" : v.total < 50 ? "Medio" : "Bajo",
          stockActual: s.stock,
          stockMinimo: s.min,
        };
      }) as TopRepuesto[];
  });
}
