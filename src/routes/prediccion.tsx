import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Brain, Sparkles, TrendingUp, AlertTriangle, ShoppingCart } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useTopRepuestos, useTendenciaFutura, useRepuestosMasConsumidos } from "@/hooks/useData";
import { usePredictions } from "@/hooks/usePredictions";

export const Route = createFileRoute("/prediccion")({
  head: () => ({
    meta: [
      { title: "IA Predictiva — Demanda de Repuestos | bpA Motors SCM" },
      { name: "description", content: "Predicción de demanda con nivel de confianza, recomendación de compra y riesgo de quiebre." },
    ],
  }),
  component: PrediccionPage,
});

const riesgoColor: Record<string, string> = {
  Bajo: "bg-success/15 text-success border-success/30",
  Medio: "bg-warning/20 text-warning-foreground border-warning/40",
  Alto: "bg-destructive/15 text-destructive border-destructive/30",
};

function PrediccionPage() {
  const { data: topRepuestos, loading: topLoading } = useTopRepuestos();
  const { data: tendenciaFutura } = useTendenciaFutura();
  const { data: repuestosMasConsumidos } = useRepuestosMasConsumidos();

  const repuestos = topRepuestos ?? [];
  const tendencia = tendenciaFutura ?? [];
  const masConsumidos = repuestosMasConsumidos ?? [];

  // Llama al endpoint /predict de FastAPI para cada repuesto real
  const codigos = useMemo(() => repuestos.map((r) => r.codigo), [repuestos]);
  const { data: predictions, loading: predLoading, error: predError } = usePredictions(codigos);

  return (
    <>
      <TopBar title="IA Predictiva" subtitle="Modelo de demanda · Recomendación de compra · Riesgo de quiebre" />
      <main className="flex-1 space-y-6 p-6">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="flex flex-wrap items-center gap-6 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary p-2.5 text-primary-foreground">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Modelo demand-forecast XGBoost</div>
                <div className="text-xs text-muted-foreground">Datos reales 2022–2025 · Horizonte: 90 días</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <Metric label="SKUs analizados" value={String(repuestos.length)} />
              <Metric label="Fuente de datos" value="Supabase" />
              <Metric label="Horizonte" value="90 días" />
            </div>
            <Badge className={`ml-auto border ${predError ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-success/15 text-success hover:bg-success/15 border-success/30"}`}>
              <Sparkles className="mr-1 h-3 w-3" />
              {predError ? "API no disponible" : predLoading ? "Consultando IA…" : "Datos en tiempo real"}
            </Badge>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Tendencia futura (histórico)</CardTitle>
              <CardDescription>Consumo real vs. proyección</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tendencia}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#42A5F5" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#42A5F5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="actual" name="Real" stroke="#0D47A1" fill="#0D47A1" fillOpacity={0.2} strokeWidth={2} />
                  <Area type="monotone" dataKey="prediccion" name="Predicción IA" stroke="#42A5F5" fill="url(#pg)" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Ranking de repuestos críticos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topLoading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
                : repuestos.filter((p) => p.riesgo !== "Bajo").map((p) => {
                    const pred = predictions[p.codigo];
                    const confianza = pred ? Math.round(pred.confianza * 100) : 75;
                    return (
                      <div key={p.codigo} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">{p.repuesto}</div>
                          <Badge variant="outline" className={riesgoColor[p.riesgo]}>{p.riesgo}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Demanda: <b className="text-foreground">{pred ? pred.cantidad_estimada : p.demanda}</b></span>
                          <span>{confianza}%</span>
                        </div>
                        <Progress value={confianza} className="mt-1.5 h-1.5" />
                      </div>
                    );
                  })}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Predicción por repuesto</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repuestos} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={12} stroke="#64748b" />
                  <YAxis dataKey="repuesto" type="category" fontSize={10} stroke="#64748b" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="demanda" name="Demanda" fill="#1565C0" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="recomendado" name="Compra recomendada" fill="#42A5F5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top consumo histórico</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={masConsumidos}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="repuesto" fontSize={9} stroke="#64748b" angle={-15} textAnchor="end" height={60} />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="consumo" fill="#0D47A1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> Recomendación de compra</CardTitle>
              <CardDescription>
                {predError
                  ? "Datos históricos (API no disponible)"
                  : predLoading
                  ? "Consultando modelo IA…"
                  : "Predicciones en tiempo real · Modelo XGBoost"}
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">Horizonte 90 días</Badge>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Repuesto</TableHead>
                    <TableHead className="text-right">Demanda estimada</TableHead>
                    <TableHead className="text-right">Confianza</TableHead>
                    <TableHead className="text-right">Compra recomendada</TableHead>
                    <TableHead>Riesgo de quiebre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 5 }).map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : repuestos.map((p) => {
                        const pred = predictions[p.codigo];
                        const demanda = pred?.cantidad_estimada ?? p.demanda;
                        const confianza = pred ? Math.round(pred.confianza * 100) : 75;
                        return (
                          <TableRow key={p.codigo}>
                            <TableCell className="font-medium">{p.repuesto}</TableCell>
                            <TableCell className="text-right">
                              {predLoading && !pred ? <Skeleton className="ml-auto h-4 w-12" /> : demanda}
                            </TableCell>
                            <TableCell className="text-right">
                              {predLoading && !pred ? (
                                <Skeleton className="ml-auto h-4 w-10" />
                              ) : (
                                <span className={confianza >= 85 ? "text-success font-semibold" : "text-warning-foreground font-semibold"}>
                                  {confianza}%
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">{p.recomendado}</TableCell>
                            <TableCell><Badge variant="outline" className={riesgoColor[p.riesgo]}>{p.riesgo}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === "success" ? "text-success" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
