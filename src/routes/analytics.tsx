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
  useConsumoMensual, useConsumoPorTipo, useDistribucionServicios, useRepuestosMasConsumidos,
} from "@/hooks/useData";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Consumo de Repuestos | bpA Motors SCM" },
      { name: "description", content: "Análisis cruzado de consumo de repuestos por tipo de servicio y temporada." },
    ],
  }),
  component: AnalyticsPage,
});

const PIE_COLORS = ["#0D47A1", "#1565C0", "#42A5F5", "#90CAF9"];

function AnalyticsPage() {
  const [temporada, setTemporada] = useState("anual");

  const { data: consumoMensual } = useConsumoMensual();
  const { data: consumoPorTipo } = useConsumoPorTipo();
  const { data: distribucionServicios } = useDistribucionServicios();
  const { data: repuestosMasConsumidos } = useRepuestosMasConsumidos();

  const consumo = consumoMensual ?? [];
  const porTipo = consumoPorTipo ?? [];
  const distribucion = distribucionServicios ?? [];
  const repuestos = repuestosMasConsumidos ?? [];

  return (
    <>
      <TopBar title="Analytics" subtitle="Análisis cruzado · Consumo de repuestos por tipo y temporada" />
      <main className="flex-1 space-y-6 p-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros dinámicos</span>
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
              Datos reales Supabase · {temporada.toUpperCase()}
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
                <BarChart data={repuestos} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={12} stroke="#64748b" />
                  <YAxis dataKey="repuesto" type="category" fontSize={10} stroke="#64748b" width={140} />
                  <Tooltip />
                  <Bar dataKey="consumo" fill="#1565C0" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo por tipo de OT</CardTitle>
              <CardDescription>Unidades totales por categoría de servicio</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porTipo}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="marca" fontSize={11} stroke="#64748b" />
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
                <LineChart data={consumo}>
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
              <CardTitle className="text-base">Distribución por tipo de servicio</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribucion} dataKey="valor" nameKey="tipo" outerRadius={95}>
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
      </main>
    </>
  );
}
