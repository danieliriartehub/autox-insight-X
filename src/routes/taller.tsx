import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ordenesTrabajo, detalleOT, type OTEstado } from "@/lib/mock-data";

export const Route = createFileRoute("/taller")({
  head: () => ({
    meta: [
      { title: "Taller — Órdenes de Trabajo | bpA Motors SCM" },
      { name: "description", content: "Gestión de órdenes de trabajo, servicios y consumo de repuestos." },
    ],
  }),
  component: TallerPage,
});

const estadoColor: Record<OTEstado, string> = {
  "Abierta": "bg-info/15 text-info border-info/30",
  "En Proceso": "bg-primary/15 text-primary border-primary/30",
  "Cerrada": "bg-success/15 text-success border-success/30",
  "Pendiente Repuesto": "bg-warning/20 text-warning-foreground border-warning/40",
};

function TallerPage() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<string>("todos");
  const [marca, setMarca] = useState<string>("todas");
  const [selected, setSelected] = useState(ordenesTrabajo[0]);

  const marcas = useMemo(() => Array.from(new Set(ordenesTrabajo.map((o) => o.marca))), []);

  const filtered = useMemo(() => {
    return ordenesTrabajo.filter((o) => {
      const matchQ = !q || `${o.id} ${o.cliente} ${o.vehiculo}`.toLowerCase().includes(q.toLowerCase());
      const matchE = estado === "todos" || o.estado === estado;
      const matchM = marca === "todas" || o.marca === marca;
      return matchQ && matchE && matchM;
    });
  }, [q, estado, marca]);

  return (
    <>
      <TopBar title="Taller" subtitle="Órdenes de trabajo y consumo de repuestos" />
      <main className="flex-1 space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Órdenes de Trabajo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar OT, cliente, vehículo…" className="w-72 pl-8" />
              </div>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="Abierta">Abierta</SelectItem>
                  <SelectItem value="En Proceso">En Proceso</SelectItem>
                  <SelectItem value="Pendiente Repuesto">Pendiente Repuesto</SelectItem>
                  <SelectItem value="Cerrada">Cerrada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={marca} onValueChange={setMarca}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Marca" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las marcas</SelectItem>
                  {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="ml-auto text-xs text-muted-foreground">
                {filtered.length} órdenes
              </div>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Número OT</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Mecánico</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow
                      key={o.id}
                      onClick={() => setSelected(o)}
                      className="cursor-pointer hover:bg-muted/40 data-[active=true]:bg-primary/5"
                      data-active={selected.id === o.id}
                    >
                      <TableCell className="font-medium text-primary">{o.id}</TableCell>
                      <TableCell>{o.fecha}</TableCell>
                      <TableCell>{o.vehiculo}</TableCell>
                      <TableCell>{o.cliente}</TableCell>
                      <TableCell>{o.mecanico}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={estadoColor[o.estado]}>{o.estado}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalle de {selected.id} · {selected.vehiculo}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Servicios realizados</h4>
              <ul className="mt-2 space-y-1.5 text-sm">
                {detalleOT.servicios.map((s) => (
                  <li key={s} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fallas detectadas</h4>
              <ul className="mt-2 space-y-1.5 text-sm">
                {detalleOT.fallas.map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-warning" />{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Repuestos utilizados</h4>
              <ul className="mt-2 space-y-1.5 text-sm">
                {detalleOT.repuestos.map((r) => (
                  <li key={r.codigo} className="flex justify-between border-b border-dashed py-1">
                    <span><span className="font-mono text-xs text-muted-foreground">{r.codigo}</span> · {r.desc}</span>
                    <span className="font-medium">x{r.cant}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estado de ejecución</span>
                <span className="font-semibold">{detalleOT.ejecucion}%</span>
              </div>
              <Progress value={detalleOT.ejecucion} />
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
