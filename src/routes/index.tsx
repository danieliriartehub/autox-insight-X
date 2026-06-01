import { createFileRoute } from "@tanstack/react-router";
import {
  Activity, ClipboardList, CheckCircle2, Package, Boxes, AlertTriangle, TrendingUp,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { TopBar } from "@/components/TopBar";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useKpis, useConsumoMensual, useDistribucionServicios, useNivelInventario } from "@/hooks/useData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard Ejecutivo — bpA Motors SCM" },
      { name: "description", content: "Indicadores clave de operación, inventario y predicción de demanda." },
    ],
  }),
  component: Dashboard,
});

const PIE_COLORS = ["#0D47A1", "#1565C0", "#42A5F5", "#90CAF9"];

function Dashboard() {
  const { data: kpis } = useKpis();
  const { data: consumoMensual } = useConsumoMensual();
  const { data: distribucionServicios } = useDistribucionServicios();
  const { data: nivelInventario } = useNivelInventario();

  const k = kpis ?? { otsAbiertas: 0, otsCerradas: 0, repuestosConsumidos: 0, inventarioDisponible: 0, quiebresStock: 0, prediccionDemanda: 0 };
  const consumo = consumoMensual ?? [];
  const distribucion = distribucionServicios ?? [];
  const nivel = nivelInventario ?? [];

  return (
    <>
      <TopBar title="Dashboard Ejecutivo" subtitle="Visión global de la operación y supply chain" />
      <main className="flex-1 space-y-6 p-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="OTs Abiertas" value={k.otsAbiertas} delta="+8% vs semana ant." trend="up" icon={ClipboardList} />
          <KpiCard label="OTs Cerradas" value={k.otsCerradas} delta="+12% MTD" trend="up" icon={CheckCircle2} tone="success" />
          <KpiCard label="Repuestos consumidos" value={k.repuestosConsumidos.toLocaleString()} delta="Mes en curso" icon={Package} />
          <KpiCard label="Inventario disponible" value={k.inventarioDisponible.toLocaleString()} delta="Unidades totales" icon={Boxes} />
          <KpiCard label="Quiebres de stock" value={k.quiebresStock} delta="Requiere atención" trend="down" icon={AlertTriangle} tone="destructive" />
          <KpiCard label="Predicción demanda" value={k.prediccionDemanda.toLocaleString()} delta="Próximo mes" trend="up" icon={TrendingUp} tone="success" />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Consumo mensual de repuestos</CardTitle>
              <CardDescription>Consumo real vs. predicción del modelo</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={consumo}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1565C0" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#1565C0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="mes" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend />
                  <Area type="monotone" dataKey="consumo" name="Consumo real" stroke="#0D47A1" fill="url(#g1)" strokeWidth={2} />
                  <Line type="monotone" dataKey="prediccion" name="Predicción IA" stroke="#42A5F5" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución por tipo de servicio</CardTitle>
              <CardDescription>Participación %</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribucion} dataKey="valor" nameKey="tipo" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {distribucion.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendencia de demanda (histórico)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={consumo}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="mes" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Line type="monotone" dataKey="consumo" stroke="#0D47A1" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nivel de inventario por categoría</CardTitle>
              <CardDescription>Stock actual vs. stock mínimo</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nivel}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="categoria" fontSize={11} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="actual" name="Stock actual" fill="#1565C0" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="minimo" name="Stock mínimo" fill="#90CAF9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Salud operacional</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { l: "Tasa de cierre OT", v: k.otsCerradas ? `${Math.round((k.otsCerradas / (k.otsCerradas + k.otsAbiertas)) * 100)}%` : "—", c: "text-success" },
              { l: "Cobertura de stock", v: "23 días", c: "text-primary" },
              { l: "Precisión predictiva", v: "91.2%", c: "text-success" },
              { l: "SLA proveedores", v: "94%", c: "text-success" },
            ].map((m) => (
              <div key={m.l} className="rounded-lg border bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.l}</div>
                <div className={`mt-1 text-2xl font-semibold ${m.c}`}>{m.v}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
