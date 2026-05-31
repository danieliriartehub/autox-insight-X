import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  consumoMensual, consumoPorMarca, distribucionServicios, repuestosMasConsumidos, vehiculosCatalogo,
} from "@/lib/mock-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Vehículo → Falla → Servicio → Repuesto | bpA Motors SCM" },
      { name: "description", content: "Análisis cruzado de consumo de repuestos por marca, modelo, servicio y temporada." },
    ],
  }),
  component: AnalyticsPage,
});

const PIE_COLORS = ["#0D47A1", "#1565C0", "#42A5F5", "#90CAF9"];

function AnalyticsPage() {
  const [marca, setMarca] = useState("todas");
  const [temporada, setTemporada] = useState("anual");

  return (
    <>
      <TopBar title="Analytics" subtitle="Análisis cruzado · Vehículo → Falla → Servicio → Repuesto" />
      <main className="flex-1 space-y-6 p-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros dinámicos</span>
            <Select value={marca} onValueChange={setMarca}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las marcas</SelectItem>
                {vehiculosCatalogo.map((v) => <SelectItem key={v.marca} value={v.marca}>{v.marca}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={temporada} onValueChange={setTemporada}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anual">Año completo</SelectItem>
                <SelectItem value="q1">Q1</SelectItem>
                <SelectItem value="q2">Q2</SelectItem>
                <SelectItem value="q3">Q3</SelectItem>
                <SelectItem value="q4">Q4</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="ml-auto border-primary/30 text-primary">
              Flujo activo: {marca === "todas" ? "Multimarca" : marca} · {temporada.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Repuestos más consumidos</CardTitle>
              <CardDescription>Top 6 por volumen</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repuestosMasConsumidos} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={12} stroke="#64748b" />
                  <YAxis dataKey="repuesto" type="category" fontSize={11} stroke="#64748b" width={130} />
                  <Tooltip />
                  <Bar dataKey="consumo" fill="#1565C0" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo por marca</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consumoPorMarca}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="marca" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="consumo" fill="#0D47A1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo por temporada</CardTitle>
              <CardDescription>Estacionalidad mensual</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={consumoMensual}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="consumo" name="Consumo" stroke="#0D47A1" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo por tipo de servicio</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribucionServicios} dataKey="valor" nameKey="tipo" outerRadius={95}>
                    {distribucionServicios.map((_, i) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flujo de análisis cruzado</CardTitle>
            <CardDescription>Trazabilidad de demanda end-to-end</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {[
                { l: "Vehículo", v: "Toyota Hilux 2021", c: "bg-primary/10 text-primary border-primary/30" },
                { l: "Falla", v: "Vibración a alta velocidad", c: "bg-warning/15 text-warning-foreground border-warning/40" },
                { l: "Servicio", v: "Balanceo + Cambio de amortiguadores", c: "bg-info/15 text-info border-info/30" },
                { l: "Repuesto", v: "Amortiguador delantero KYB x2", c: "bg-success/15 text-success border-success/30" },
              ].map((s, idx, arr) => (
                <div key={s.l} className="flex items-center gap-3">
                  <div className={`rounded-lg border px-3 py-2 ${s.c}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{s.l}</div>
                    <div className="text-sm font-medium">{s.v}</div>
                  </div>
                  {idx < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
