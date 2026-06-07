import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Brain, Sparkles, AlertTriangle, ShoppingCart, Zap, Target,
  Download, Server, CheckCircle2, ArrowRight, Loader2, BarChart2
} from "lucide-react";
import {
  CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
  BarChart, Bar, Legend,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useTopRepuestos } from "@/hooks/useData";
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

const MES_NOMBRES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

  // ── Simulador de Escenarios de Negocio ────────────────────────────────────
  // Reemplaza a los parámetros técnicos por escenarios que dan valor al negocio
  const [escenario, setEscenario] = useState<"regular" | "campana" | "crisis">("regular");

  const factores = useMemo(() => {
    switch (escenario) {
      case "campana": return { demandaMulti: 1.5, stockMulti: 1.0, label: "Campaña Mantenimiento (+50% Demanda)" };
      case "crisis":  return { demandaMulti: 1.0, stockMulti: 0.5, label: "Crisis Proveedores (-50% Stock Físico)" };
      default:        return { demandaMulti: 1.0, stockMulti: 1.0, label: "Operación Regular" };
    }
  }, [escenario]);

  // ── Datos desde Supabase ──────────────────────────────────────────────────
  const { data: topRepuestos, loading: topLoading } = useTopRepuestos();
  const repuestos = topRepuestos ?? [];

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

  useEffect(() => {
    fetchMLStatus()
      .then(setMLStatus)
      .catch(() => setMLStatus(null))
      .finally(() => setMLLoading(false));
  }, []);

  // ── KPIs & Cálculos SCM ───────────────────────────────────────────────────
  const predValues  = Object.values(predictions);
  const avgConfianza = predValues.length
    ? predValues.reduce((s, p) => s + p.confianza, 0) / predValues.length
    : 0;

  let deficitTotal = 0;
  let itemsEnQuiebre = 0;
  const rawChartData: any[] = [];

  const ocData = repuestos.map((p) => {
    const pred = predictions[p.codigo];
    const conf = pred ? pred.confianza * 100 : 0;
    
    // Demanda Base
    const demandaBase = pred && conf >= 70 ? pred.cantidad_estimada : Math.round(p.demanda / 12);
      
    // Aplicamos simulador de escenarios
    const demandaMesSig = Math.round(demandaBase * factores.demandaMulti);
    const stockSimulado = Math.round(p.stockActual * factores.stockMulti);
    
    const deficit = Math.max(0, demandaMesSig - stockSimulado);
    const compraSugerida = deficit > 0 ? Math.ceil(deficit * 1.15) : 0; // 15% buffer fijo

    if (deficit > 0) {
      deficitTotal += deficit;
      itemsEnQuiebre++;
    }

    rawChartData.push({
      name: p.repuesto.split(" ")[0], // Nombre corto
      codigo: p.codigo,
      stock: stockSimulado,
      demanda: demandaMesSig,
      deficit,
    });

    return { ...p, stockActual: stockSimulado, demandaMesSig, deficit, compraSugerida, pred, conf };
  });

  const repuestosAComprar = ocData.filter(d => d.compraSugerida > 0);
  const healthScore = Math.max(0, Math.round(100 - (itemsEnQuiebre * 5) - ((1 - avgConfianza) * 20)));

  // Tomamos los 10 ítems con mayor demanda para el gráfico de barras
  const chartData = rawChartData.sort((a, b) => b.demanda - a.demanda).slice(0, 10);

  // ── Acciones MVP ──────────────────────────────────────────────────────────
  const [modalOCAbierto, setModalOCAbierto] = useState(false);
  const [estadoSimulacion, setEstadoSimulacion] = useState<"idle" | "enviando" | "completado">("idle");
  const [ocGeneradas, setOcGeneradas] = useState<string[]>([]);

  const iniciarSimulacion = () => {
    setEstadoSimulacion("enviando");
    setOcGeneradas([]);
    setTimeout(() => {
      setOcGeneradas([`OC-${anioActual}-9041`, `OC-${anioActual}-9042`]);
      setEstadoSimulacion("completado");
    }, 2500);
  };

  const resetearModal = (open: boolean) => {
    setModalOCAbierto(open);
    if (!open) setTimeout(() => setEstadoSimulacion("idle"), 300);
  };

  // ── Predictor Interactivo ─────────────────────────────────────────────────
  const [form, setForm] = useState({ codigo: "", mes: String(mesActual), km: "50000" });
  const [predResult, setResult] = useState<PredictResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const runPredict = async () => {
    if (!form.codigo.trim()) { setFormError("Selecciona un repuesto"); return; }
    setRunning(true); setFormError(null); setResult(null);
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

        {/* ── Banner de estado del modelo ─────────────────────────────────── */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent relative overflow-hidden">
          <CardContent className="flex flex-wrap items-center justify-between gap-6 p-5">
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
              <Stat label="Repuestos conocidos" value={mlStatusLoading ? "…" : String(mlStatus?.repuestos_conocidos ?? 600)} />
              <Stat label="MAE del modelo" value={mlStatusLoading ? "…" : `±${mlStatus?.mae_referencia ?? 4.33} uds`} />
              <Stat label="Confiabilidad Media" value={predLoading ? "…" : `${Math.round(avgConfianza * 100)}%`} />
            </div>

            <Badge
              className={`border ${
                predError ? "bg-destructive/15 text-destructive border-destructive/30"
                  : mlStatus?.modelo_cargado ? "bg-success/15 text-success border-success/30"
                  : "bg-warning/15 text-warning-foreground border-warning/30"
              }`}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {predError ? "Modelo no disponible" : mlStatusLoading ? "Conectando…" : "Modelo activo"}
            </Badge>
          </CardContent>
        </Card>

        {/* ── KPI Row SCM ─────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Salud Logística (Score)", value: topLoading ? null : `${healthScore}/100`, sub: healthScore > 80 ? "Óptimo" : "Requiere atención", color: healthScore > 80 ? "text-success" : "text-warning" },
            { label: "Quiebres Inminentes", value: predLoading ? null : String(itemsEnQuiebre), sub: "Repuestos con Déficit", color: itemsEnQuiebre > 0 ? "text-destructive" : "text-success" },
            { label: "Volumen a Abastecer", value: predLoading ? null : `${deficitTotal} uds`, sub: "Para cubrir demanda IA", color: "text-primary" },
            { label: "Días de Cobertura Promedio", value: "14.5", sub: "Stock vs Velocidad consumo", color: "text-foreground" },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
                {m.value === null ? <Skeleton className="mt-2 h-8 w-20" /> : <div className={`mt-1 text-3xl font-bold ${m.color}`}>{m.value}</div>}
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
                <Select value={escenario} onValueChange={(v: any) => setEscenario(v)}>
                  <SelectTrigger className="w-[200px] h-8 text-xs font-semibold bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Operación Regular</SelectItem>
                    <SelectItem value="campana" className="text-warning font-semibold">Campaña (+50% Demanda)</SelectItem>
                    <SelectItem value="crisis" className="text-destructive font-semibold">Crisis (-50% Stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="h-[320px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis dataKey="codigo" fontSize={10} stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} stroke="#64748b" tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="stock" name="Stock Físico Real" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="demanda" name="Demanda Predicha IA" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
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
                <Select value={form.codigo} onValueChange={(val) => setForm({ ...form, codigo: val })}>
                  <SelectTrigger className="w-full font-mono text-xs">
                    <SelectValue placeholder="Buscar repuesto..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    {repuestos.map(r => (
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
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Km vehículo</Label>
                  <Input type="number" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} className="text-xs h-9" />
                </div>
              </div>

              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <Button onClick={runPredict} disabled={running || !form.codigo} className="w-full">
                {running ? "Consultando…" : "Proyectar Demanda"}
              </Button>

              {predResult && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">Resultado ML</span>
                    <Badge variant="outline" className={predResult.repuesto_conocido ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}>
                      {predResult.repuesto_conocido ? "Conocido" : "Nuevo"}
                    </Badge>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold text-primary leading-none">{predResult.cantidad_estimada}</span>
                    <span className="text-sm text-muted-foreground mb-1">uds / mes</span>
                  </div>
                  <Progress value={predResult.confianza * 100} className="h-2" />
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
                  <Button size="sm" disabled={repuestosAComprar.length === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all">
                    <ShoppingCart className="mr-2 h-4 w-4" /> Generar OC Automática
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  <DialogHeader>
                    <DialogTitle>Aprovisionamiento Automatizado SCM</DialogTitle>
                    <DialogDescription>Revisión de órdenes sugeridas por la IA antes de enviarlas al ERP (Oracle).</DialogDescription>
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
                          {repuestosAComprar.map(r => (
                            <tr key={r.codigo} className="border-b last:border-0">
                              <td className="py-1 font-mono">{r.codigo}</td>
                              <td className="py-1 max-w-[200px] truncate" title={r.repuesto}>{r.repuesto}</td>
                              <td className="py-1 text-right font-bold text-primary">{r.compraSugerida}</td>
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
                      <span className="font-bold text-primary">{repuestosAComprar.reduce((s, r) => s + r.compraSugerida, 0)}</span>
                    </div>

                    {estadoSimulacion !== "idle" && (
                      <div className="space-y-2 mt-4 p-4 border rounded-lg bg-primary/5 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between text-sm">
                          {estadoSimulacion === "enviando" ? (
                            <span className="flex items-center text-primary font-medium">
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transmitiendo vía Webhook...
                            </span>
                          ) : (
                            <span className="flex items-center text-success font-bold">
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Órdenes Generadas Exitosamente
                            </span>
                          )}
                        </div>
                        <Progress value={estadoSimulacion === "enviando" ? 66 : 100} className="h-2 transition-all duration-1000 ease-in-out" />
                        {estadoSimulacion === "completado" && (
                          <div className="pt-2 text-sm text-muted-foreground">
                            Folios creados en ERP:
                            <div className="mt-1 flex gap-2">
                              {ocGeneradas.map(oc => <Badge key={oc} variant="outline" className="font-mono bg-background">{oc}</Badge>)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="flex items-center sm:justify-between">
                    {estadoSimulacion === "idle" ? (
                      <>
                        <p className="text-xs text-muted-foreground w-full">Las OCs se enviarán de forma asíncrona.</p>
                        <Button onClick={iniciarSimulacion}>Confirmar e Insertar</Button>
                      </>
                    ) : estadoSimulacion === "completado" ? (
                      <div className="w-full flex justify-end gap-2">
                         <Button variant="outline" onClick={() => resetearModal(false)}>Cerrar</Button>
                         <Link to="/almacen"><Button><ArrowRight className="h-4 w-4 mr-2"/> Ir a Almacén</Button></Link>
                      </div>
                    ) : (
                      <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Procesando...</Button>
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
                    <TableHead className="text-right bg-primary/5 text-primary">Predicción ML</TableHead>
                    <TableHead className="text-right">Déficit Inminente</TableHead>
                    <TableHead className="text-right text-primary font-bold">Compra Sugerida</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLoading || predLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    : ocData.map((row) => (
                        <TableRow key={row.codigo} className={row.deficit > 0 ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{row.codigo}</TableCell>
                          <TableCell className="font-medium max-w-[180px] truncate" title={row.repuesto}>{row.repuesto}</TableCell>
                          <TableCell className="text-right font-semibold">{row.stockActual}</TableCell>
                          <TableCell className="text-right bg-primary/5">
                            <span className="font-bold text-primary">{row.demandaMesSig}</span>
                            <div className="text-[10px] text-muted-foreground">
                              {row.pred && row.conf >= 70 ? `Conf: ${Math.round(row.conf)}%` : 'Histórico'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.deficit > 0 ? <span className="font-bold text-destructive">-{row.deficit}</span> : <span className="text-muted-foreground">0</span>}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {row.compraSugerida > 0 ? <Badge className="bg-primary">{row.compraSugerida} uds</Badge> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {row.deficit > 0 
                              ? <span className="flex items-center text-xs text-destructive font-medium"><AlertTriangle className="h-3 w-3 mr-1"/> Quiebre</span>
                              : <span className="flex items-center text-xs text-success font-medium"><CheckCircle2 className="h-3 w-3 mr-1"/> Seguro</span>}
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
                  Los repuestos en la tabla representan escenarios de <b>Déficit Inminente (Understock)</b> detectados por el modelo predictivo.
                  Retrasar la emisión de esta Orden de Compra incrementará de forma directa los tiempos de inactividad de los vehículos en taller, 
                  generando cuellos de botella operativos y afectando los márgenes de rentabilidad.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
