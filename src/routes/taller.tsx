import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useOrdenesTrabajo, useDetalleOT, type OTEstado } from "@/hooks/useData";

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
  const { data: ordenes, loading } = useOrdenesTrabajo();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<string>("todos");
  const [selectedId, setSelectedId] = useState<string>("");

  const ordenesTrabajo = ordenes ?? [];
  const selected = ordenesTrabajo.find((o) => o.id === selectedId) ?? ordenesTrabajo[0];
  const { data: detalle, loading: detalleLoading } = useDetalleOT(selected?.id ?? "");

  const filtered = useMemo(() => {
    return ordenesTrabajo.filter((o) => {
      const matchQ = !q || `${o.id} ${o.cliente} ${o.vehiculo}`.toLowerCase().includes(q.toLowerCase());
      const matchE = estado === "todos" || o.estado === estado;
      return matchQ && matchE;
    });
  }, [ordenesTrabajo, q, estado]);

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
              <div className="ml-auto text-xs text-muted-foreground">{filtered.length} órdenes</div>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Número OT</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Requerimiento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : filtered.map((o) => (
                        <TableRow
                          key={o.id}
                          onClick={() => setSelectedId(o.id)}
                          className="cursor-pointer hover:bg-muted/40 data-[active=true]:bg-primary/5"
                          data-active={selected?.id === o.id}
                        >
                          <TableCell className="font-medium text-primary">{o.id}</TableCell>
                          <TableCell>{o.fecha}</TableCell>
                          <TableCell>{o.vehiculo}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{o.cliente}</TableCell>
                          <TableCell>{o.marca}</TableCell>
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

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle de {selected.id} · Placa {selected.vehiculo}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Repuestos utilizados</h4>
                {detalleLoading ? (
                  <div className="mt-2 space-y-2">
                    {[1,2,3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {(detalle?.repuestos ?? []).length === 0 ? (
                      <li className="text-muted-foreground text-xs">Sin repuestos registrados</li>
                    ) : (detalle?.repuestos ?? []).map((r) => (
                      <li key={r.codigo} className="flex justify-between border-b border-dashed py-1">
                        <span><span className="font-mono text-xs text-muted-foreground">{r.codigo}</span> · {r.desc}</span>
                        <span className="font-medium">x{r.cant}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requerimiento</h4>
                <p className="mt-2 text-sm text-muted-foreground">{selected.cliente}</p>
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estado de ejecución</span>
                    <span className="font-semibold">{selected.estado === "Cerrada" ? "100%" : selected.estado === "En Proceso" ? "60%" : "0%"}</span>
                  </div>
                  <Progress value={selected.estado === "Cerrada" ? 100 : selected.estado === "En Proceso" ? 60 : 0} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
