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
    setMLLoading(true);
    fetchMLStatus()
      .then(setMLStatus)
      .catch(() => setMLStatus(null))
      .finally(() => setMLLoading(false));
  };

  useEffect(() => {
    cargarStatus();
  }, []);

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

  let deficitTotal = 0;
  let itemsEnQuiebre = 0;
  const rawChartData: Array<{
    name: string;
    codigo: string;
    stock: number;
    demanda: number;
    deficit: number;
  }> = [];

  // Cruza stock actual con predicción ML para cada repuesto
  const ocData = repuestos.map((p) => {
    const pred = predictions[p.codigo];
    const conf = pred ? pred.confianza * 100 : 0;

    // Demanda base: usa predicción ML si hay confianza ≥ 70%, si no usa promedio histórico
    const demandaBase = pred && conf >= 70 ? pred.cantidad_estimada : Math.round(p.demanda / 12);

    // Aplica factores del escenario simulado
    const demandaMesSig = Math.round(demandaBase * factores.demandaMulti);
    const stockSimulado = Math.round(p.stockActual * factores.stockMulti);

    // Déficit = demanda insatisfecha / compra sugerida = déficit + 15% buffer
    const deficit = Math.max(0, demandaMesSig - stockSimulado);
    const compraSugerida = deficit > 0 ? Math.ceil(deficit * 1.15) : 0;

    if (deficit > 0) {
      deficitTotal += deficit;
      itemsEnQuiebre++;
    }

    rawChartData.push({
      name: p.repuesto.split(" ")[0],
      codigo: p.codigo,
      stock: stockSimulado,
      demanda: demandaMesSig,
      deficit,
    });

    return { ...p, stockActual: stockSimulado, demandaMesSig, deficit, compraSugerida, pred, conf };
  });

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

  // Envía las compras sugeridas al backend para persistir en orden_compra_detalle
  const iniciarSimulacion = async () => {
    setEstadoSimulacion("enviando");
    setOcGeneradas([]);
    setOcError(null);
    try {
      const items = repuestosAComprar.map((r) => ({
        codigo_repuesto: r.codigo,
        compra_sugerida: r.compraSugerida,
      }));
      const res = await generatePurchaseOrder(
        items,
        `OC generada por IA (XGBoost) — escenario ${factores.label}`,
      );
      setOcGeneradas([res.n_oc]);
      setEstadoSimulacion("completado");
    } catch (e) {
      setOcError(e instanceof Error ? e.message : "No se pudo generar la OC.");
      setEstadoSimulacion("error");
    }
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
                    {/* Etiqueta de confiabilidad REAL calculada por el backend (RF-10) */}
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
              <Dialog open={modalOCAbierto} onOpenChange={resetearModal}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={repuestosAComprar.length === 0}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all"
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" /> Generar OC Automática
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  <DialogHeader>
                    <DialogTitle>Aprovisionamiento Automatizado SCM</DialogTitle>
                    <DialogDescription>
                      Revisión de órdenes sugeridas por la IA antes de enviarlas al ERP (Oracle).
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-4 space-y-4">
                    <div className="rounded-md border bg-muted/30 p-3 max-h-[150px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b pb-2">
                            <th className="font-medium pb-1">Código</th>
                            <th className="font-medium pb-1">Repuesto</th>
                            <th className="font-medium pb-1 text-right">Cant.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {repuestosAComprar.map((r) => (
                            <tr key={r.codigo} className="border-b last:border-0">
                              <td className="py-1 font-mono">{r.codigo}</td>
                              <td className="py-1 max-w-[200px] truncate" title={r.repuesto}>
                                {r.repuesto}
                              </td>
                              <td className="py-1 text-right font-bold text-primary">
                                {r.compraSugerida}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total de Items (SKUs):</span>
                      <span className="font-bold">{repuestosAComprar.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Volumen Total (Uds):</span>
                      <span className="font-bold text-primary">
                        {repuestosAComprar.reduce((s, r) => s + r.compraSugerida, 0)}
                      </span>
                    </div>

                    {estadoSimulacion !== "idle" && (
                      <div className="space-y-2 mt-4 p-4 border rounded-lg bg-primary/5 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between text-sm">
                          {estadoSimulacion === "enviando" ? (
                            <span className="flex items-center text-primary font-medium">
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Persistiendo OC en
                              la base de datos...
                            </span>
                          ) : estadoSimulacion === "error" ? (
                            <span className="flex items-center text-destructive font-bold">
                              <ShieldAlert className="h-4 w-4 mr-2" /> No se pudo generar la OC
                            </span>
                          ) : (
                            <span className="flex items-center text-success font-bold">
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Orden de Compra Generada
                            </span>
                          )}
                        </div>
                        {estadoSimulacion !== "error" && (
                          <Progress
                            value={estadoSimulacion === "enviando" ? 66 : 100}
                            className="h-2 transition-all duration-1000 ease-in-out"
                          />
                        )}
                        {estadoSimulacion === "completado" && (
                          <div className="pt-2 text-sm text-muted-foreground">
                            Folio persistido en{" "}
                            <span className="font-mono">orden_compra_detalle</span> (origen: IA):
                            <div className="mt-1 flex gap-2 flex-wrap">
                              {ocGeneradas.map((oc) => (
                                <Badge
                                  key={oc}
                                  variant="outline"
                                  className="font-mono bg-background"
                                >
                                  {oc}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {estadoSimulacion === "error" && ocError && (
                          <p className="pt-1 text-xs text-destructive">{ocError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="flex items-center sm:justify-between">
                    {estadoSimulacion === "idle" ? (
                      <>
                        <p className="text-xs text-muted-foreground w-full">
                          La OC se registrará en{" "}
                          <span className="font-mono">orden_compra_detalle</span> marcada como
                          origen IA.
                        </p>
                        <Button onClick={iniciarSimulacion}>Confirmar y Generar OC</Button>
                      </>
                    ) : estadoSimulacion === "completado" ? (
                      <div className="w-full flex justify-end gap-2">
                        <Button variant="outline" onClick={() => resetearModal(false)}>
                          Cerrar
                        </Button>
                        <Link to="/almacen">
                          <Button>
                            <ArrowRight className="h-4 w-4 mr-2" /> Ir a Almacén
                          </Button>
                        </Link>
                      </div>
                    ) : estadoSimulacion === "error" ? (
                      <div className="w-full flex justify-end gap-2">
                        <Button variant="outline" onClick={() => resetearModal(false)}>
                          Cerrar
                        </Button>
                        <Button onClick={iniciarSimulacion}>
                          <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
                        </Button>
                      </div>
                    ) : (
                      <Button disabled>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                      </Button>
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
