import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
}

// ── helpers internos ──────────────────────────────────────────────────────────

function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function parseFecha(s: string | null | undefined): Date | null {
  if (!s) return null;
  const parts = String(s).split(" ")[0].split("/");
  if (parts.length < 3) return null;
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

function mapEstado(c: string | null | undefined): OTEstado {
  if (!c) return "Abierta";
  if (c === "S7") return "Cerrada";
  if (c === "S6") return "En Proceso";
  if (c === "S5") return "Pendiente Repuesto";
  return "Abierta";
}

function mapTipo(t: string | null | undefined): string {
  if (!t) return "Otro";
  if (t === "R") return "Correctivo";
  if (t === "M") return "Preventivo";
  if (t === "P") return "Planchado y Pintura";
  if (t === "E") return "Embellecimiento";
  return "Otro";
}

function extractCategoria(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("filtro")) return "Filtros";
  if (d.includes("aceite") || d.includes("lubricante")) return "Aceites";
  if (d.includes("freno") || d.includes("pastilla") || d.includes("disco")) return "Frenos";
  if (d.includes("amortiguador") || d.includes("suspen") || d.includes("resorte")) return "Suspensión";
  if (d.includes("bateria") || d.includes("faro") || d.includes("electr")) return "Eléctrico";
  if (d.includes("correa") || d.includes("motor") || d.includes("piston")) return "Motor";
  return "Otros";
}

function calcEstado(stock: number, min: number, max: number): StockEstado {
  if (stock <= 0) return "Crítico";
  if (stock < min) return "Bajo";
  if (stock > max) return "Exceso";
  return "Óptimo";
}

// ── hooks públicos ────────────────────────────────────────────────────────────

export function useKpis() {
  return useQuery<Kpis>(async () => {
    const [cabRes, prodRes] = await Promise.all([
      supabase.from("ot_cabecera").select("c_estado"),
      supabase.from("ot_producto").select("cantidad").limit(5000),
    ]);
    const cab = cabRes.data ?? [];
    const prod = prodRes.data ?? [];

    const otsAbiertas = cab.filter((c) => c.c_estado !== "S7").length;
    const otsCerradas = cab.filter((c) => c.c_estado === "S7").length;
    const repuestosConsumidos = Math.round(prod.reduce((s, p) => s + (Number(p.cantidad) || 0), 0));

    // Items con stock bajo: códigos cuya cantidad total < umbral 10
    const byCode: Record<string, number> = {};
    prod.forEach((p: Record<string, unknown>) => {
      const code = String(p.codigo ?? "");
      byCode[code] = (byCode[code] ?? 0) + (Number(p.cantidad) || 0);
    });
    const quiebresStock = Object.values(byCode).filter((v) => v < 10).length;

    return {
      otsAbiertas,
      otsCerradas,
      repuestosConsumidos,
      inventarioDisponible: repuestosConsumidos,
      quiebresStock,
      prediccionDemanda: Math.round(repuestosConsumidos * 1.12),
    };
  });
}

export function useConsumoMensual() {
  return useQuery(async () => {
    const { data } = await supabase
      .from("ot_producto")
      .select("cantidad, fecha_registro")
      .limit(5000);
    if (!data) return [];

    const grouped: Record<string, { consumo: number; mes: string }> = {};
    for (const row of data) {
      const d = parseFecha(row.fecha_registro as string);
      if (!d) continue;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[ym]) grouped[ym] = { consumo: 0, mes: MESES[d.getMonth()] };
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

export function useDistribucionServicios() {
  return useQuery(async () => {
    const { data } = await supabase.from("ot_cabecera").select("c_tipoot");
    if (!data) return [];

    const counts: Record<string, number> = {};
    for (const row of data) {
      const tipo = mapTipo(row.c_tipoot as string);
      counts[tipo] = (counts[tipo] ?? 0) + 1;
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(counts).map(([tipo, n]) => ({
      tipo,
      valor: Math.round((n / total) * 100),
    }));
  });
}

export function useNivelInventario() {
  return useQuery(async () => {
    const { data } = await supabase
      .from("ot_producto")
      .select("descripcion, cantidad")
      .limit(5000);
    if (!data) return [];

    const byCat: Record<string, number> = {};
    for (const row of data) {
      const cat = extractCategoria(String(row.descripcion ?? ""));
      byCat[cat] = (byCat[cat] ?? 0) + (Number(row.cantidad) || 0);
    }
    return Object.entries(byCat).map(([categoria, actual]) => ({
      categoria,
      actual: Math.round(actual),
      minimo: Math.round(actual * 0.3),
    }));
  });
}

export function useOrdenesTrabajo() {
  return useQuery<OrdenTrabajo[]>(async () => {
    const { data } = await supabase
      .from("ot_cabecera")
      .select("ot, fecha, placa, c_estado, c_tipoot, requerimiento")
      .order("fecha", { ascending: false })
      .limit(100);
    if (!data) return [];

    return data.map((row) => ({
      id: `OT-${row.ot}`,
      fecha: String(row.fecha ?? "").split(" ")[0],
      vehiculo: String(row.placa ?? "—"),
      cliente: (String(row.requerimiento ?? "—")).slice(0, 45) || "—",
      estado: mapEstado(row.c_estado as string),
      mecanico: "—",
      marca: mapTipo(row.c_tipoot as string),
      modelo: "—",
    }));
  });
}

export function useDetalleOT(otId: string) {
  const otNum = otId.replace("OT-", "");
  return useQuery(async () => {
    if (!otNum) return { servicios: [], fallas: [], repuestos: [], ejecucion: 0 };
    const { data } = await supabase
      .from("ot_producto")
      .select("codigo, descripcion, cantidad")
      .eq("n_ot", Number(otNum));
    const repuestos = (data ?? []).map((r) => ({
      codigo: String(r.codigo ?? ""),
      desc: String(r.descripcion ?? r.codigo ?? ""),
      cant: Number(r.cantidad) || 0,
    }));
    return {
      servicios: repuestos.length ? ["Ver repuestos en tabla"] : ["Sin repuestos registrados"],
      fallas: [],
      repuestos,
      ejecucion: 100,
    };
  }, [otNum]);
}

export function useInventario() {
  return useQuery<ItemInventario[]>(async () => {
    const { data } = await supabase
      .from("ot_producto")
      .select("codigo, descripcion, cantidad")
      .limit(5000);
    if (!data) return [];

    const byCode: Record<string, { repuesto: string; total: number }> = {};
    for (const row of data) {
      const code = String(row.codigo ?? "");
      if (!byCode[code]) byCode[code] = { repuesto: String(row.descripcion ?? code), total: 0 };
      byCode[code].total += Number(row.cantidad) || 0;
    }

    return Object.entries(byCode)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 60)
      .map(([codigo, v]) => {
        const stock = Math.round(v.total);
        const min = Math.max(5, Math.round(stock * 0.2));
        const max = Math.round(stock * 1.5);
        return {
          codigo,
          repuesto: v.repuesto,
          categoria: extractCategoria(v.repuesto),
          marca: "—",
          stock,
          min,
          max,
          estado: calcEstado(stock, min, max),
        };
      });
  });
}

export function useMovimientos() {
  return useQuery<Movimiento[]>(async () => {
    const { data } = await supabase
      .from("oc_detalle")
      .select("n_oc, cantidad, c_repuesto")
      .order("idinterno", { ascending: false })
      .limit(30);
    if (!data) return [];

    return data.map((row, i) => {
      const d = new Date(Date.now() - i * 3 * 3600000 * 24);
      return {
        fecha: d.toISOString().split("T")[0],
        tipo: "Entrada" as const,
        codigo: String(row.c_repuesto ?? "—"),
        cant: Number(row.cantidad) || 0,
        ref: `OC-${row.n_oc}`,
      };
    });
  });
}

export function useRepuestosMasConsumidos() {
  return useQuery(async () => {
    const { data } = await supabase
      .from("ot_producto")
      .select("descripcion, cantidad")
      .limit(5000);
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
      .map(([repuesto, consumo]) => ({ repuesto: repuesto.slice(0, 28), consumo: Math.round(consumo) }));
  });
}

export function useConsumoPorTipo() {
  return useQuery(async () => {
    const [cabRes, prodRes] = await Promise.all([
      supabase.from("ot_cabecera").select("ot, c_tipoot"),
      supabase.from("ot_producto").select("n_ot, cantidad").limit(5000),
    ]);
    const cab = cabRes.data ?? [];
    const prod = prodRes.data ?? [];

    const otTipo: Record<string, string> = {};
    for (const c of cab) otTipo[String(c.ot)] = mapTipo(c.c_tipoot as string);

    const byTipo: Record<string, number> = {};
    for (const p of prod) {
      const tipo = otTipo[String(p.n_ot)] ?? "Otro";
      byTipo[tipo] = (byTipo[tipo] ?? 0) + (Number(p.cantidad) || 0);
    }
    return Object.entries(byTipo)
      .sort(([, a], [, b]) => b - a)
      .map(([marca, consumo]) => ({ marca, consumo: Math.round(consumo) }));
  });
}

export function useTendenciaFutura() {
  return useQuery(async () => {
    const { data } = await supabase
      .from("ot_producto")
      .select("cantidad, fecha_registro")
      .limit(5000);
    if (!data) return [];

    const grouped: Record<string, { consumo: number; mes: string }> = {};
    for (const row of data) {
      const d = parseFecha(row.fecha_registro as string);
      if (!d) continue;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[ym]) grouped[ym] = { consumo: 0, mes: MESES[d.getMonth()] };
      grouped[ym].consumo += Number(row.cantidad) || 0;
    }

    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([ym, v]) => ({
        mes: v.mes,
        actual: ym <= nowYM ? Math.round(v.consumo) : null,
        prediccion: Math.round(v.consumo * (ym <= nowYM ? 1 : 1.1)),
      }));
  });
}

export function useTopRepuestos() {
  return useQuery<TopRepuesto[]>(async () => {
    const { data } = await supabase
      .from("ot_producto")
      .select("codigo, descripcion, cantidad")
      .limit(5000);
    if (!data) return [];

    const byCode: Record<string, { desc: string; total: number }> = {};
    for (const row of data) {
      const code = String(row.codigo ?? "");
      if (!byCode[code]) byCode[code] = { desc: String(row.descripcion ?? code), total: 0 };
      byCode[code].total += Number(row.cantidad) || 0;
    }

    return Object.entries(byCode)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 7)
      .map(([codigo, v]) => ({
        codigo,
        repuesto: v.desc.slice(0, 30),
        demanda: Math.round(v.total),
        recomendado: Math.round(v.total * 1.2),
        riesgo: v.total < 10 ? "Alto" : v.total < 50 ? "Medio" : "Bajo",
      })) as TopRepuesto[];
  });
}
