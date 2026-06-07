import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Brain, Sparkles, TrendingUp, AlertTriangle, ShoppingCart, Zap, Target,
  Download, Send, Server, CheckCircle2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
  Scatter, ScatterChart, ZAxis, ReferenceLine,
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import {
  useTopRepuestos, useTendenciaFutura, useRepuestosMasConsumidos,
} from "@/hooks/useData";
import { usePredictions } from "@/hooks/usePredictions";
import { fetchPrediction, fetchMLStatus, type PredictResponse } from "@/services/predict";

// ── Ruta ──────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/prediccion")({
  head: () => ({
    meta: [
      { title: "Comando SCM Predictivo | bpA Motors" },
      { name: "description", content: "Centro de Comando SCM impulsado por IA para previsión de demanda." },
    ],
  }),
  component: PrediccionPage,
});

// ── Constantes ────────────────────────────────────────────────────────────────

const MES_NOMBRES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const riesgoColor: Record<string, string> = {
  Bajo:  "bg-success/15 text-success border-success/30",
  Medio: "bg-warning/20 text-warning-foreground border-warning/40",
  Alto:  "bg-destructive/15 text-destructive border-destructive/30",
};

type MLStatus = {
  modelo_cargado: boolean;
  version: string | null;
  repuestos_conocidos: number | null;
  mae_referencia: number;
};

// ── Componente principal ──────────────────────────────────────────────────────

function PrediccionPage() {
  const mesActual  = new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();

  // ── Datos desde Supabase ──────────────────────────────────────────────────
  const { data: topRepuestos,   loading: topLoading }  = useTopRepuestos();
  const { data: tendenciaData }                         = useTendenciaFutura();
  const { data: masConsumidos }                         = useRepuestosMasConsumidos();

  const repuestos = topRepuestos ?? [];
  const tendencia = tendenciaData ?? [];

  // ── Predicciones ML (repuestos × mes actual) ──────────────────────────────
  const codigos = useMemo(() => repuestos.map((r) => r.codigo), [repuestos]);
  const {
    data: predictions,
    loading: predLoading,
    error: predError,
  } = usePredictions(codigos, mesActual, anioActual);

  // ── Estado del modelo ML ──────────────────────────────────────────────────
  const [mlStatus, setMLStatus]       = useState<MLStatus | null>(null);
  const [mlStatusLoading, setMLLoading] = useState(true);

  useEffect(() => {
    fetchMLStatus()
      .then(setMLStatus)
      .catch(() => setMLStatus(null))
      .finally(() => setMLLoading(false));
  }, []);

  // ── KPIs & Health Score SCM ───────────────────────────────────────────────
  const predValues  = Object.values(predictions);
  const avgConfianza = predValues.length
    ? predValues.reduce((s, p) => s + p.confianza, 0) / predValues.length
    : 0;

  // Calculamos quiebres inminentes (Déficit > 0)
  let deficitTotal = 0;
  let itemsEnQuiebre = 0;
  const scatterData: any[] = [];

  const ocData = repuestos.map((p) => {
    const pred = predictions[p.codigo];
    const demandaMesSig = pred ? pred.cantidad_estimada : Math.round(p.demanda / 12);
    const deficit = Math.max(0, demandaMesSig - p.stockActual);
    const compraSugerida = deficit > 0 ? Math.ceil(deficit * 1.15) : 0; // 15% buffer seguridad

    if (deficit > 0) {
      deficitTotal += deficit;
      itemsEnQuiebre++;
    }

    scatterData.push({
      x: p.stockActual,
      y: demandaMesSig,
      z: 100, // tamaño del punto
      name: p.repuesto,
      codigo: p.codigo,
      deficit,
    });

    return { ...p, demandaMesSig, deficit, compraSugerida, pred };
  });

  // Health Score (0-100)
  // Penaliza por items en quiebre inminente y baja confianza del modelo
  const healthScore = Math.max(0, Math.round(100 - (itemsEnQuiebre * 5) - ((1 - avgConfianza) * 20)));

  // ── Acciones de MVP (Simulación ERP) ──────────────────────────────────────
  const [enviandoERP, setEnviandoERP] = useState(false);

  const exportarAExcel = () => {
    const headers = ["Codigo", "Repuesto", "Stock_Actual", "Prediccion_ML_Mes", "Deficit", "Compra_Sugerida"];
    const rows = ocData.map((row) => 
      `${row.codigo},"${row.repuesto}",${row.stockActual},${row.demandaMesSig},${row.deficit},${row.compraSugerida}`
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `OC_Inteligente_${mesActual}_${anioActual}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.alert("Exportación exitosa. El archivo CSV está listo para cargarse al ERP Oracle.");
  };

  const simularEnvioERP = () => {
    setEnviandoERP(true);
    setTimeout(() => {
      setEnviandoERP(false);
      window.alert(`Sincronización simulada exitosa. Se han enviado ${ocData.filter(d => d.compraSugerida > 0).length} requerimientos al sistema ERP FoxPro/Oracle.`);
    }, 1500);
  };

  // ── Predictor interactivo ─────────────────────────────────────────────────
  const [form, setForm]         = useState({ codigo: "", mes: String(mesActual), km: "50000" });
  const [predResult, setResult] = useState<PredictResponse | null>(null);
  const [running, setRunning]   = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const runPredict = async () => {
    if (!form.codigo.trim()) { setFormError("Ingresa un código de repuesto"); return; }
    setRunning(true); setFormError(null); setResult(null);
    try {
      const res = await fetchPrediction({
        codigo_repuesto: form.codigo.trim(),
        mes: Number(form.mes),
        anio: anioActual,
        km: Number(form.km) || 50_000,
      });
      setResult(res);
    } catch {
      setFormError("No se pudo conectar al modelo. Verifica Railway.");
    } finally {
      setRunning(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <TopBar
        title="Centro de Comando SCM Predictivo"
        subtitle={`Inteligencia Artificial aplicada al abastecimiento · ${MES_NOMBRES[mesActual]} ${anioActual}`}
      />
      <main className="flex-1 space-y-6 p-6">

        {/* ── Banner de estado del modelo ─────────────────────────────────── */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="flex flex-wrap items-center gap-6 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/20">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">XGBoost Demand Forecaster</div>
                <div className="text-xs text-muted-foreground">
                  7,645 transacciones reales · 600 repuestos · 2019–2026
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <Stat label="Repuestos conocidos"
                value={mlStatusLoading ? "…" : String(mlStatus?.repuestos_conocidos ?? 600)} />
              <Stat label="MAE del modelo"
                value={mlStatusLoading ? "…" : `±${mlStatus?.mae_referencia ?? 4.33} uds`} />
              <Stat label="Confiabilidad"
                value={predLoading ? "…" : `${Math.round(avgConfianza * 100)}%`} />
            </div>

            <Badge
              className={`ml-auto border ${
                predError
                  ? "bg-destructive/15 text-destructive border-destructive/30"
                  : mlStatus?.modelo_cargado
                  ? "bg-success/15 text-success hover:bg-success/15 border-success/30"
                  : "bg-warning/15 text-warning-foreground border-warning/30"
              }`}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {predError
                ? "Modelo no disponible"
                : mlStatusLoading
                ? "Conectando…"
                : "Modelo activo · Railway"}
            </Badge>
          </CardContent>
        </Card>

        {/* ── KPI Row SCM ─────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Salud Logística (Score)",
              value: topLoading ? null : `${healthScore}/100`,
              sub: healthScore > 80 ? "Óptimo" : "Requiere atención",
              color: healthScore > 80 ? "text-success" : "text-warning",
            },
            {
              label: "Quiebres Inminentes",
              value: predLoading ? null : String(itemsEnQuiebre),
              sub: "Repuestos con Déficit (Demanda > Stock)",
              color: itemsEnQuiebre > 0 ? "text-destructive" : "text-success",
            },
            {
              label: "Volumen a Abastecer",
              value: predLoading ? null : `${deficitTotal} uds`,
              sub: "Para cubrir demanda del mes",
              color: "text-primary",
            },
            {
              label: "Días de Cobertura Promedio",
              value: "14.5",
              sub: "Stock actual vs Velocidad consumo ML",
              color: "text-foreground",
            },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
                {m.value === null
                  ? <Skeleton className="mt-2 h-8 w-20" />
                  : <div className={`mt-1 text-3xl font-bold ${m.color}`}>{m.value}</div>
                }
                <div className="mt-1 text-xs text-muted-foreground">{m.sub}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Matriz SCM & Acciones ───────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Matriz de Decisión */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Matriz de Decisión SCM
              </CardTitle>
              <CardDescription>Clasificación automática de inventario (Stock Actual vs Predicción ML)</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" dataKey="x" name="Stock Actual" fontSize={12} stroke="#64748b" />
                  <YAxis type="number" dataKey="y" name="Predicción Mes" fontSize={12} stroke="#64748b" />
                  <ZAxis type="number" dataKey="z" range={[60, 400]} />
                  <RechartsTooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(val: number, name: string) => [val, name]}
                    labelFormatter={() => ""}
                  />
                  {/* Línea de equilibrio (Stock = Demanda) */}
                  <ReferenceLine x={20} stroke="red" strokeDasharray="3 3" opacity={0} />
                  <Scatter name="Repuestos" data={scatterData} fill="#1565C0">
                    {scatterData.map((entry, index) => (
                      <cell key={`cell-${index}`} fill={entry.deficit > 0 ? "#dc2626" : (entry.x > entry.y * 3 ? "#0288d1" : "#10b981")} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Understock (Quiebre inminente)</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success" /> Stock Saludable (Buffer)</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-info" /> Overstock (Baja rotación)</span>
              </div>
            </CardContent>
          </Card>

          {/* Predictor interactivo (On-demand) */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/3 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Consulta Predictiva Puntual
              </CardTitle>
              <CardDescription>Consulta el modelo bajo demanda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Quick-pick */}
              <div className="space-y-1.5">
                <Label className="text-xs">Código de repuesto</Label>
                <Input
                  placeholder="ej. FILTRO-01"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && runPredict()}
                  className="font-mono text-sm"
                />
                {repuestos.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {repuestos.slice(0, 3).map((r) => (
                      <button
                        key={r.codigo}
                        onClick={() => setForm({ ...form, codigo: r.codigo })}
                        className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      >
                        {r.codigo}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Mes</Label>
                  <select
                    value={form.mes}
                    onChange={(e) => setForm({ ...form, mes: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    {MES_NOMBRES.slice(1).map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Km vehículo</Label>
                  <Input
                    type="number"
                    placeholder="50000"
                    value={form.km}
                    onChange={(e) => setForm({ ...form, km: e.target.value })}
                  />
                </div>
              </div>

              {formError && <p className="text-xs text-destructive">{formError}</p>}

              <Button onClick={runPredict} disabled={running} className="w-full">
                {running ? "Consultando…" : "Predecir demanda"}
              </Button>

              {predResult && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Resultado ML</span>
                    <Badge variant="outline" className={predResult.repuesto_conocido ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}>
                      {predResult.repuesto_conocido ? "Conocido" : "Nuevo"}
                    </Badge>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold text-primary leading-none">{predResult.cantidad_estimada}</span>
                    <span className="text-sm text-muted-foreground mb-1">uds / mes</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Confianza</span>
                      <span className="font-semibold">{Math.round(predResult.confianza * 100)}%</span>
                    </div>
                    <Progress value={predResult.confianza * 100} className="h-2" />
                  </div>
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
                Cruzando inventario en tiempo real con proyecciones del modelo de Machine Learning
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportarAExcel}>
                <Download className="mr-2 h-4 w-4" /> Exportar (ERP CSV)
              </Button>
              <Button size="sm" onClick={simularEnvioERP} disabled={enviandoERP || ocData.length === 0}>
                {enviandoERP ? (
                  <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />
                ) : (
                  <Server className="mr-2 h-4 w-4" />
                )}
                Sincronizar a Oracle
              </Button>
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
                    <TableHead className="text-right bg-primary/5 text-primary">Predicción ML (Mes)</TableHead>
                    <TableHead className="text-right">Déficit Inminente</TableHead>
                    <TableHead className="text-right text-primary font-bold">Compra Sugerida</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLoading || predLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : ocData.map((row) => (
                        <TableRow key={row.codigo} className={row.deficit > 0 ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{row.codigo}</TableCell>
                          <TableCell className="font-medium max-w-[180px] truncate" title={row.repuesto}>{row.repuesto}</TableCell>
                          
                          <TableCell className="text-right font-semibold">
                            {row.stockActual}
                          </TableCell>
                          
                          <TableCell className="text-right bg-primary/5">
                            <span className="font-bold text-primary">{row.demandaMesSig}</span>
                            <div className="text-[10px] text-muted-foreground">
                              {row.pred ? `Conf: ${Math.round(row.pred.confianza * 100)}%` : 'Histórico'}
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right">
                            {row.deficit > 0 
                              ? <span className="font-bold text-destructive">-{row.deficit}</span>
                              : <span className="text-muted-foreground">0</span>}
                          </TableCell>
                          
                          <TableCell className="text-right font-bold">
                            {row.compraSugerida > 0 
                              ? <Badge className="bg-primary hover:bg-primary">{row.compraSugerida} uds</Badge>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          
                          <TableCell>
                            {row.deficit > 0 
                              ? <span className="flex items-center text-xs text-destructive font-medium"><AlertTriangle className="h-3 w-3 mr-1"/> Quiebre Riesgo</span>
                              : <span className="flex items-center text-xs text-success font-medium"><CheckCircle2 className="h-3 w-3 mr-1"/> Stock Seguro</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Disclaimer para MVP */}
            <div className="mt-4 flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <Server className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                <b>Aviso de Arquitectura Desacoplada:</b> Al sincronizar, el sistema web emite un webhook hacia la capa de integración. 
                El servidor local (Oracle 18c XE / Visual FoxPro) debe consumir esta cola de requerimientos de forma asíncrona para no saturar 
                la infraestructura local on-premise (RNF-01).
              </p>
            </div>
          </CardContent>
        </Card>

      </main>
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
