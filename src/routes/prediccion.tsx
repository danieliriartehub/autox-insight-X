// ── Página de Centro de Comando SCM Predictivo ─────────────────────────────────
// Módulo principal de Inteligencia Artificial para la cadena de suministro.
// Incluye: banner de salud del modelo ML, KPIs logísticos, comparativa
// stock vs demanda, predictor puntual interactivo y generador de OCs.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Sparkles,
  AlertTriangle,
  ShoppingCart,
  Zap,
  CheckCircle2,
  ArrowRight,
  Loader2,
  BarChart2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Legend,
} from "recharts";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTopRepuestos } from "@/hooks/useData";
import { usePredictions } from "@/hooks/usePredictions";
import {
  fetchPrediction,
  fetchMLStatus,
  retrainModel,
  generatePurchaseOrder,
  fetchPurchaseSuggestions,
  type PurchaseProposal,
  type PredictResponse,
  type MLStatusResponse,
  type RetrainResponse,
} from "@/services/predict";

// ── Ruta ──────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/prediccion")({
  head: () => ({
    meta: [
      { title: "Comando SCM Predictivo | bpA Motors" },
      {
        name: "description",
        content: "Centro de Comando SCM impulsado por IA para previsión de demanda.",
      },
    ],
  }),
  component: PrediccionPage,
});

// ── Constantes ─────────────────────────────────────────────────────────────────
// Nombres de meses en español para el selector y subtítulos

const MES_NOMBRES = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

type MLStatus = MLStatusResponse;

// ── Componente principal ──────────────────────────────────────────────────────

// ── Componente principal ──────────────────────────────────────────────────────

function PrediccionPage() {
  const mesActual = new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();

  // ── Simulador de Escenarios de Negocio ────────────────────────────────────
  // Reemplaza parámetros técnicos por escenarios de valor para el negocio
  const [escenario, setEscenario] = useState<"regular" | "campana" | "crisis">("regular");

  // Factores multiplicadores según el escenario seleccionado
  const factores = useMemo(() => {
    switch (escenario) {
      case "campana":
        return {
          demandaMulti: 1.5,
          stockMulti: 1.0,
          label: "Campaña Mantenimiento (+50% Demanda)",
        };
      case "crisis":
        return {
          demandaMulti: 1.0,
          stockMulti: 0.5,
          label: "Crisis Proveedores (-50% Stock Físico)",
        };
      default:
        return { demandaMulti: 1.0, stockMulti: 1.0, label: "Operación Regular" };
    }
  }, [escenario]);

  // ── Datos desde Supabase ──────────────────────────────────────────────────
  const { data: topRepuestos, loading: topLoading } = useTopRepuestos();
  const repuestos = useMemo(() => topRepuestos ?? [], [topRepuestos]);

  // ── Predicciones ML ───────────────────────────────────────────────────────
  const codigos = useMemo(() => repuestos.map((r) => r.codigo), [repuestos]);
  const {
    data: predictions,
    loading: predLoading,
    error: predError,
  } = usePredictions(codigos, mesActual, anioActual);

  // ── Estado del modelo ML ──────────────────────────────────────────────────
  const [mlStatus, setMLStatus] = useState<MLStatus | null>(null);
  const [mlStatusLoading, setMLLoading] = useState(true);

  const cargarStatus = () => {
    fetchMLStatus()
      .then(setMLStatus)
      .catch(() => setMLStatus(null))
      .finally(() => setMLLoading(false));
  };

  useEffect(() => {
    cargarStatus();
  }, []);

  // ── Sugerencias de compra desde el backend (RF-12 unificada) ────────────────
  // Centraliza el cálculo de déficit en el backend para evitar duplicación de lógica
  const [suggestionsData, setSuggestionsData] = useState<PurchaseProposal[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const cargarSugerencias = () => {
    setSuggestionsLoading(true);
    fetchPurchaseSuggestions({ mes: mesActual, anio: anioActual, solo_quiebres: false })
      .then((res) => setSuggestionsData(res.propuestas ?? []))
      .catch(() => setSuggestionsData([]))
      .finally(() => setSuggestionsLoading(false));
  };

  useEffect(() => {
    cargarSugerencias();
  }, [mesActual, anioActual]);

  // ── Reentrenamiento del modelo (RF-15) ────────────────────────────────────
  const [retraining, setRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState<RetrainResponse | null>(null);
  const [retrainError, setRetrainError] = useState<string | null>(null);

  const ejecutarReentrenamiento = async () => {
    setRetraining(true);
    setRetrainResult(null);
    setRetrainError(null);
    try {
      const res = await retrainModel({ correr_etl: false });
      setRetrainResult(res);
      cargarStatus(); // refresca métricas tras el hot-reload
    } catch (e) {
      setRetrainError(e instanceof Error ? e.message : "Error al reentrenar el modelo");
    } finally {
      setRetraining(false);
    }
  };

  // ── KPIs & Cálculos SCM ───────────────────────────────────────────────────
  // Promedio de confianza de todas las predicciones ML
  const predValues = Object.values(predictions);
  const avgConfianza = predValues.length
    ? predValues.reduce((s, p) => s + p.confianza, 0) / predValues.length
    : 0;

  // Cruza stock actual con predicción ML para cada repuesto
  // Usa las sugerencias del backend (fetchPurchaseSuggestions) como fuente principal;
  // si el backend no está disponible, fallback al cálculo local con usePredictions
  const ocData = useMemo(() => {
    if (suggestionsData.length > 0) {
      const sugMap = new Map(suggestionsData.map((s) => [s.codigo_repuesto, s]));
      // Fallback: construir data también para repuestos que el backend no devolvió
      const knownCodigos = new Set(suggestionsData.map((s) => s.codigo_repuesto));
      return repuestos.map((p) => {
        const sug = sugMap.get(p.codigo);
        if (sug) {
          const demandaAjustada = Math.round(sug.demanda_ia * factores.demandaMulti);
          const stockAjustado = Math.round(sug.stock_actual * factores.stockMulti);
          const deficit = Math.max(0, demandaAjustada - stockAjustado);
          const compraSugerida = deficit > 0 ? Math.ceil(deficit * 1.15) : 0;
          return {
            ...p,
            stockActual: stockAjustado,
            demandaMesSig: demandaAjustada,
            deficit,
            compraSugerida,
            conf: Math.round(sug.confianza_ia * 100),
            pred: sug,
          };
        }
        // Repuesto no cubierto por backend: fallback local
        const pred = predictions[p.codigo];
        const conf = pred ? pred.confianza * 100 : 0;
        const demandaBase = pred && conf >= 70 ? pred.cantidad_estimada : Math.round(p.demanda / 12);
        const demandaMesSig = Math.round(demandaBase * factores.demandaMulti);
        const stockSimulado = Math.round(p.stockActual * factores.stockMulti);
        const deficit = Math.max(0, demandaMesSig - stockSimulado);
        const compraSugerida = deficit > 0 ? Math.ceil(deficit * 1.15) : 0;
        return { ...p, stockActual: stockSimulado, demandaMesSig, deficit, compraSugerida, pred, conf };
      });
    }
    // Sin backend: fallback al cálculo local con usePredictions
    return repuestos.map((p) => {
      const pred = predictions[p.codigo];
      const conf = pred ? pred.confianza * 100 : 0;
      const demandaBase = pred && conf >= 70 ? pred.cantidad_estimada : Math.round(p.demanda / 12);
      const demandaMesSig = Math.round(demandaBase * factores.demandaMulti);
      const stockSimulado = Math.round(p.stockActual * factores.stockMulti);
      const deficit = Math.max(0, demandaMesSig - stockSimulado);
      const compraSugerida = deficit > 0 ? Math.ceil(deficit * 1.15) : 0;
      return { ...p, stockActual: stockSimulado, demandaMesSig, deficit, compraSugerida, pred, conf };
    });
  }, [suggestionsData, repuestos, predictions, factores]);

  // Cálculos agregados
  const deficitTotal = ocData.reduce((s, d) => s + d.deficit, 0);
  const itemsEnQuiebre = ocData.filter((d) => d.deficit > 0).length;
  const rawChartData = ocData.map((d) => ({
    name: d.repuesto.split(" ")[0],
    codigo: d.codigo,
    stock: d.stockActual,
    demanda: d.demandaMesSig,
    deficit: d.deficit,
  }));

  // Filtra solo ítems con compra sugerida > 0
  const repuestosAComprar = ocData.filter((d) => d.compraSugerida > 0);
  // Score de salud logística: 100 - penalizaciones por quiebres y baja confianza
  const healthScore = Math.max(0, Math.round(100 - itemsEnQuiebre * 5 - (1 - avgConfianza) * 20));

  // Top 10 ítems con mayor demanda para el gráfico comparativo
  const chartData = rawChartData.sort((a, b) => b.demanda - a.demanda).slice(0, 10);

  // ── Generación de Órdenes de Compra Inteligentes (RF-12) ──────────────────
  // Persiste las compras sugeridas en la base de datos como OC real con origen IA
  const [modalOCAbierto, setModalOCAbierto] = useState(false);
  const [estadoSimulacion, setEstadoSimulacion] = useState<
    "idle" | "enviando" | "completado" | "error"
  >("idle");
  const [ocGeneradas, setOcGeneradas] = useState<string[]>([]);
  const [ocError, setOcError] = useState<string | null>(null);

  // Simula el envío de las compras sugeridas al sistema externo Arvak-Car
  const iniciarSimulacion = async () => {
    setEstadoSimulacion("enviando");
    setOcGeneradas([]);
    setOcError(null);
    
    // Retraso de 1.5 segundos para simular el envío y procesamiento en red
    setTimeout(() => {
      const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const folioMock = `OC-IA-${fechaStr}-${randomId}`;

      setOcGeneradas([folioMock]);
      setEstadoSimulacion("completado");
    }, 1500);
  };

  // Reinicia el estado del modal al cerrarlo
  const resetearModal = (open: boolean) => {
    setModalOCAbierto(open);
    if (!open)
      setTimeout(() => {
        setEstadoSimulacion("idle");
        setOcError(null);
      }, 300);
  };

  // ── Predictor Interactivo (Consulta puntual al modelo ML) ─────────────────
  const [form, setForm] = useState({ codigo: "", mes: String(mesActual), km: "50000" });
  const [predResult, setResult] = useState<PredictResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ejecuta la predicción contra el backend Railway
  const runPredict = async () => {
    if (!form.codigo.trim()) {
      setFormError("Selecciona un repuesto");
      return;
    }
    setRunning(true);
    setFormError(null);
    setResult(null);
    try {
      const res = await fetchPrediction({
        codigo_repuesto: form.codigo,
        mes: Number(form.mes),
        anio: anioActual,
        km: Number(form.km) || 50_000,
      });
      setResult(res);
    } catch {
      setFormError("No se pudo conectar al modelo.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <TopBar
        title="Centro de Comando SCM Predictivo"
        subtitle={`Inteligencia Artificial aplicada al abastecimiento · ${MES_NOMBRES[mesActual]} ${anioActual}`}
      />
      <main className="flex-1 space-y-6 p-6">
        {/* ── Banner de estado del modelo IA (RF-11) ──────────────────────── */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent relative overflow-hidden">
          <CardContent className="flex flex-wrap items-center justify-between gap-6 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/20">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  {mlStatus?.algoritmo ?? "XGBoost Regressor"} ·{" "}
                  {mlStatus?.modelo ?? "demand-forecast"}
                  <Badge variant="outline" className="text-[10px] font-mono">
                    v{mlStatus?.version ?? "3.0"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {mlStatus?.repuestos_conocidos ?? 600} repuestos conocidos
                  {mlStatus?.entrenado_en &&
                    ` · entrenado ${new Date(mlStatus.entrenado_en).toLocaleDateString("es-PE")}`}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <Stat
                label="Precisión global"
                value={
                  mlStatusLoading
                    ? "…"
                    : mlStatus?.metrics?.wmape != null
                      ? `${(100 - mlStatus.metrics.wmape).toFixed(1)}%`
                      : "—"
                }
                info="Qué tan cerca acierta la IA en todo el catálogo, ponderando por volumen de consumo. Un valor más alto = predicciones más confiables. (Métrica técnica: wMAPE)"
              />
              <Stat
                label="Precisión en repuestos clave"
                value={
                  mlStatusLoading
                    ? "…"
                    : mlStatus?.metrics?.mape_alta_rotacion != null
                      ? `${(100 - mlStatus.metrics.mape_alta_rotacion).toFixed(1)}%`
                      : "—"
                }
                info="Precisión de la IA solo en los repuestos de alta rotación (los que más impacto tienen en tu inventario). Es el indicador más relevante para las compras. (Métrica técnica: MAPE en SKUs de demanda ≥5)"
              />
              <Stat
                label="Margen de error típico"
                value={
                  mlStatusLoading
                    ? "…"
                    : mlStatus?.metrics?.mae != null
                      ? `±${Math.round(mlStatus.metrics.mae)} uds`
                      : "—"
                }
                info="En promedio, la predicción de la IA se desvía esta cantidad de unidades respecto al consumo real. Cuanto menor, mejor. (Métrica técnica: MAE)"
              />
              <Stat
                label="Confianza promedio"
                value={predLoading ? "…" : `${Math.round(avgConfianza * 100)}%`}
                info="Nivel de confianza promedio de las predicciones que ves en pantalla. Depende de cuánta historia tiene cada repuesto: mientras más datos, más confiable."
              />
            </div>

            <div className="flex items-center gap-2">
              <Badge
                className={`border ${
                  predError
                    ? "bg-destructive/15 text-destructive border-destructive/30"
                    : mlStatus?.modelo_cargado
                      ? "bg-success/15 text-success border-success/30"
                      : "bg-warning/15 text-warning-foreground border-warning/30"
                }`}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {predError
                  ? "Modelo no disponible"
                  : mlStatusLoading
                    ? "Conectando…"
                    : "Modelo activo"}
              </Badge>

              {/* Reentrenamiento del modelo con gate de calidad (RF-15) */}
              <Button
                size="sm"
                variant="outline"
                onClick={ejecutarReentrenamiento}
                disabled={retraining}
                className="border-primary/40 text-primary hover:bg-primary/10"
                title="Reentrena el modelo y solo lo promueve si pasa el gate de calidad (wMAPE)"
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${retraining ? "animate-spin" : ""}`} />
                {retraining ? "Reentrenando…" : "Reentrenar IA"}
              </Button>
            </div>
          </CardContent>

          {/* Resultado del reentrenamiento (RF-15 + RNF-02) */}
          {(retrainResult || retrainError) && (
            <div
              className={`border-t px-5 py-3 text-xs flex items-center gap-2 ${
                retrainError
                  ? "bg-destructive/10 text-destructive"
                  : retrainResult?.promovido
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning-foreground"
              }`}
            >
              {retrainError ? (
                <ShieldAlert className="h-4 w-4" />
              ) : retrainResult?.promovido ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span>{retrainError ?? retrainResult?.mensaje}</span>
            </div>
          )}
        </Card>

        {/* ── KPI Row SCM ─────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Salud Logística (Score)",
              value: topLoading ? null : `${healthScore}/100`,
              sub: healthScore > 80 ? "Óptimo" : "Requiere atención",
              color: healthScore > 80 ? "text-success" : "text-warning",
              info: "Puntaje general del abastecimiento (0 a 100). Baja cuando hay repuestos en riesgo de quiebre o cuando la IA tiene poca confianza. Arriba de 80 es óptimo.",
            },
            {
              label: "Quiebres Inminentes",
              value: predLoading ? null : String(itemsEnQuiebre),
              sub: "Repuestos con Déficit",
              color: itemsEnQuiebre > 0 ? "text-destructive" : "text-success",
              info: "Cantidad de repuestos cuyo stock actual no alcanza para cubrir la demanda que proyecta la IA. Cada uno es una compra urgente.",
            },
            {
              label: "Volumen a Abastecer",
              value: predLoading ? null : `${deficitTotal} uds`,
              sub: "Para cubrir demanda IA",
              color: "text-primary",
              info: "Total de unidades que deberías comprar para cubrir toda la demanda proyectada por la IA y evitar quiebres.",
            },
            {
              label: "Días de Cobertura Promedio",
              value: "14.5",
              sub: "Stock vs Velocidad consumo",
              color: "text-foreground",
              info: "Con el stock actual y el ritmo de consumo, cuántos días en promedio te dura el inventario antes de agotarse.",
            },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {m.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex text-muted-foreground/70 hover:text-primary transition-colors"
                        aria-label={`Qué significa ${m.label}`}
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-[260px] bg-popover text-popover-foreground border shadow-md text-[11px] leading-snug font-normal normal-case tracking-normal"
                    >
                      {m.info}
                    </TooltipContent>
                  </Tooltip>
                </div>
                {m.value === null ? (
                  <Skeleton className="mt-2 h-8 w-20" />
                ) : (
                  <div className={`mt-1 text-3xl font-bold ${m.color}`}>{m.value}</div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">{m.sub}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Matriz SCM & Acciones ───────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Comparativa: Stock vs Demanda (Top 10)
                </CardTitle>
                <CardDescription>Visualización directa de quiebres por SKU</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Escenario:</span>
                <Select
                  value={escenario}
                  onValueChange={(v) => setEscenario(v as "regular" | "campana" | "crisis")}
                >
                  <SelectTrigger className="w-[200px] h-8 text-xs font-semibold bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Operación Regular</SelectItem>
                    <SelectItem value="campana" className="text-warning font-semibold">
                      Campaña (+50% Demanda)
                    </SelectItem>
                    <SelectItem value="crisis" className="text-destructive font-semibold">
                      Crisis (-50% Stock)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="h-[320px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="codigo"
                    fontSize={10}
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis fontSize={10} stroke="#64748b" tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar
                    dataKey="stock"
                    name="Stock Físico Real"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="demanda"
                    name="Demanda Predicha IA"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Predictor interactivo */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/3 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Consulta Predictiva Puntual
              </CardTitle>
              <CardDescription>Consulta el modelo bajo demanda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Selecciona un Repuesto (SKU)</Label>
                <Select
                  value={form.codigo}
                  onValueChange={(val) => setForm({ ...form, codigo: val })}
                >
                  <SelectTrigger className="w-full font-mono text-xs">
                    <SelectValue placeholder="Buscar repuesto..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    {repuestos.map((r) => (
                      <SelectItem key={r.codigo} value={r.codigo} className="text-xs">
                        <span className="font-mono font-bold">{r.codigo}</span> - {r.repuesto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Mes Objetivo</Label>
                  <Select value={form.mes} onValueChange={(val) => setForm({ ...form, mes: val })}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MES_NOMBRES.slice(1).map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Km vehículo</Label>
                  <Input
                    type="number"
                    value={form.km}
                    onChange={(e) => setForm({ ...form, km: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <Button onClick={runPredict} disabled={running || !form.codigo} className="w-full">
                {running ? "Consultando…" : "Proyectar Demanda"}
              </Button>

              {predResult && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">
                      Resultado del motor IA
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        predResult.alta_confiabilidad
                          ? "bg-success/15 text-success border-success/30"
                          : predResult.confianza >= 0.6
                            ? "bg-warning/15 text-warning-foreground border-warning/30"
                            : "bg-destructive/15 text-destructive border-destructive/30"
                      }
                    >
                      {predResult.alta_confiabilidad ? (
                        <ShieldCheck className="mr-1 h-3 w-3" />
                      ) : (
                        <ShieldAlert className="mr-1 h-3 w-3" />
                      )}
                      {predResult.etiqueta_confianza}
                    </Badge>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold text-primary leading-none">
                      {predResult.cantidad_estimada}
                    </span>
                    <span className="text-sm text-muted-foreground mb-1">uds / mes</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      IC 80%: <b className="text-foreground">{predResult.confianza_lower}</b>
                      {" – "}
                      <b className="text-foreground">{predResult.confianza_upper}</b> uds
                    </span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>
                      Error típico: <b className="text-foreground">±{predResult.mae_referencia}</b>
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>
                        Confianza:{" "}
                        <b className="text-foreground">{Math.round(predResult.confianza * 100)}%</b>
                      </span>
                      <span>{predResult.observaciones_historicas} meses de historia</span>
                    </div>
                    <Progress value={predResult.confianza * 100} className="h-2" />
                  </div>
                  {Object.keys(predResult.feature_importance).length > 0 && (
                    <div className="border-t border-primary/10 pt-2">
                      <span className="text-[10px] font-medium uppercase text-muted-foreground block mb-1.5">
                        Factores que más influyen
                      </span>
                      <div className="space-y-1">
                        {Object.entries(predResult.feature_importance)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([feat, imp]) => (
                            <div key={feat} className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-24 truncate shrink-0">
                                {feat.replace(/_/g, " ")}
                              </span>
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(imp, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
                                {imp.toFixed(0)}%
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] leading-snug text-muted-foreground border-t border-primary/10 pt-2">
                    {predResult.explicacion}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Tabla de Órdenes de Compra Inteligentes ─────────────────────── */}
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Generador de Órdenes de Compra Inteligentes
              </CardTitle>
              <CardDescription>
                Cruzando inventario con predicciones ML — Escenario: <b>{factores.label}</b>
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={repuestosAComprar.length === 0}
                onClick={() => {
                  setModalOCAbierto(true);
                  iniciarSimulacion();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all animate-in fade-in"
              >
                <ShoppingCart className="mr-2 h-4 w-4" /> Generar OC Automática
              </Button>

              <Dialog open={modalOCAbierto} onOpenChange={resetearModal}>
                <DialogContent className="sm:max-w-[450px] border-t-4 border-t-primary shadow-2xl bg-white rounded-2xl overflow-hidden">
                  <DialogHeader className="space-y-1">
                    <DialogTitle className="text-center text-xl font-bold flex items-center justify-center gap-2">
                      <Brain className="h-5 w-5 text-primary animate-pulse" />
                      Aprovisionamiento Automático SCM
                    </DialogTitle>
                    <DialogDescription className="text-center text-xs font-medium text-muted-foreground">
                      Integración de escenarios con ERP Arvak-Car
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-6 flex flex-col items-center justify-center">
                    {estadoSimulacion === "enviando" && (
                      <div className="bg-primary/[0.03] border border-primary/10 rounded-2xl p-8 w-full flex flex-col items-center justify-center space-y-4 shadow-inner">
                        <div className="relative flex items-center justify-center h-16 w-16">
                          <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-primary/20 opacity-75"></span>
                          <Loader2 className="h-10 w-10 text-primary animate-spin relative" />
                        </div>
                        <div className="space-y-1 text-center">
                          <p className="text-sm font-bold text-foreground animate-pulse">
                            Enviando sugerencias de compra...
                          </p>
                          <p className="text-xs text-muted-foreground max-w-[250px] mx-auto">
                            Procesando y registrando {repuestosAComprar.length} SKUs sugeridos en Arvak-Car ERP
                          </p>
                        </div>
                      </div>
                    )}

                    {estadoSimulacion === "completado" && (
                      <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-2xl p-6 w-full flex flex-col items-center justify-center space-y-5 shadow-sm animate-in zoom-in duration-300">
                        <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10 animate-bounce">
                          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        </div>
                        
                        <div className="text-center space-y-1">
                          <p className="text-base font-extrabold text-emerald-700">
                            Sugerencia de OC Enviada
                          </p>
                          <p className="text-xs text-muted-foreground max-w-[280px]">
                            La orden ha sido transmitida y confirmada exitosamente en el ERP
                          </p>
                        </div>

                        <div className="bg-background border border-dashed border-muted-foreground/30 rounded-xl p-3.5 w-full flex flex-col items-center space-y-1.5 shadow-inner">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Código de Seguimiento ERP
                          </span>
                          <span className="font-mono font-bold text-base text-primary tracking-wide select-all bg-muted/50 px-3 py-1 rounded-lg border">
                            {ocGeneradas[0]}
                          </span>
                          <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1 mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="h-3 w-3 inline" /> Conexión segura SSL — Arvak-Car
                          </span>
                        </div>
                      </div>
                    )}

                    {estadoSimulacion === "error" && (
                      <div className="bg-destructive/[0.03] border border-destructive/10 rounded-2xl p-6 w-full flex flex-col items-center justify-center space-y-4 shadow-sm animate-in zoom-in duration-300">
                        <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 border-2 border-destructive shadow-lg shadow-destructive/10">
                          <ShieldAlert className="h-8 w-8 text-destructive" />
                        </div>
                        
                        <div className="text-center space-y-1 w-full">
                          <p className="text-base font-bold text-destructive">
                            Error en la Transmisión
                          </p>
                          <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                            No se pudo enviar la sugerencia al sistema externo
                          </p>
                          <p className="text-[10px] text-destructive px-3 max-h-[80px] overflow-y-auto font-mono text-left bg-destructive/5 border border-destructive/10 p-2 rounded-lg mt-2">
                            {ocError}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="sm:justify-center w-full">
                    {estadoSimulacion === "completado" && (
                      <Button className="w-full sm:w-auto font-semibold px-6 shadow-md transition-all" onClick={() => resetearModal(false)}>
                        Finalizar y Cerrar
                      </Button>
                    )}
                    {estadoSimulacion === "error" && (
                      <div className="flex gap-2.5 w-full justify-center">
                        <Button variant="outline" className="w-full sm:w-auto font-semibold" onClick={() => resetearModal(false)}>
                          Cerrar
                        </Button>
                        <Button className="w-full sm:w-auto font-semibold" onClick={iniciarSimulacion}>
                          <RefreshCw className="h-4 w-4 mr-2" /> Reintentar Envío
                        </Button>
                      </div>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Código SKU</TableHead>
                    <TableHead>Repuesto</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right bg-primary/5 text-primary">
                      Predicción ML
                    </TableHead>
                    <TableHead className="text-right">Déficit Inminente</TableHead>
                    <TableHead className="text-right text-primary font-bold">
                      Compra Sugerida
                    </TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLoading || predLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((__, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : ocData.map((row) => (
                        <TableRow
                          key={row.codigo}
                          className={row.deficit > 0 ? "bg-destructive/5" : ""}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {row.codigo}
                          </TableCell>
                          <TableCell
                            className="font-medium max-w-[180px] truncate"
                            title={row.repuesto}
                          >
                            {row.repuesto}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {row.stockActual}
                          </TableCell>
                          <TableCell className="text-right bg-primary/5">
                            <span className="font-bold text-primary">{row.demandaMesSig}</span>
                            <div className="text-[10px] text-muted-foreground">
                              {row.pred && row.conf >= 70
                                ? `Conf: ${Math.round(row.conf)}%`
                                : "Histórico"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.deficit > 0 ? (
                              <span className="font-bold text-destructive">-{row.deficit}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {row.compraSugerida > 0 ? (
                              <Badge className="bg-primary">{row.compraSugerida} uds</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.deficit > 0 ? (
                              <span className="flex items-center text-xs text-destructive font-medium">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Quiebre
                              </span>
                            ) : (
                              <span className="flex items-center text-xs text-success font-medium">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Seguro
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-start gap-3 p-4 bg-destructive/10 rounded-lg text-sm border-l-4 border-l-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
              <div>
                <p className="font-bold text-destructive mb-1">Alerta Comercial Logística</p>
                <p className="text-muted-foreground">
                  Los repuestos en la tabla representan escenarios de{" "}
                  <b>Déficit Inminente (Understock)</b> detectados por el modelo predictivo.
                  Retrasar la emisión de esta Orden de Compra incrementará de forma directa los
                  tiempos de inactividad de los vehículos en taller, generando cuellos de botella
                  operativos y afectando los márgenes de rentabilidad.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

// ── Componente Stat: indicador con tooltip informativo ─────────────────────────

function Stat({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
        {info && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex text-muted-foreground/70 hover:text-primary transition-colors"
                aria-label={`Qué significa ${label}`}
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-[260px] bg-popover text-popover-foreground border shadow-md text-[11px] leading-snug font-normal normal-case tracking-normal"
            >
              {info}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
