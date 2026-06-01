import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Search, ShoppingCart } from "lucide-react";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useInventario, useMovimientos, type StockEstado } from "@/hooks/useData";
import { usePredictions } from "@/hooks/usePredictions";

export const Route = createFileRoute("/almacen")({
  head: () => ({
    meta: [
      { title: "Almacén — Inventario | bpA Motors SCM" },
      { name: "description", content: "Gestión de inventario, movimientos y alertas de stock." },
    ],
  }),
  component: AlmacenPage,
});

const estadoStock: Record<StockEstado, string> = {
  "Óptimo": "bg-success/15 text-success border-success/30",
  "Bajo": "bg-warning/20 text-warning-foreground border-warning/40",
  "Crítico": "bg-destructive/15 text-destructive border-destructive/30",
  "Exceso": "bg-info/15 text-info border-info/30",
};

function AlmacenPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todas");

  const { data: inventarioData, loading: invLoading } = useInventario();
  const { data: movimientosData, loading: movLoading } = useMovimientos();

  const inventario = inventarioData ?? [];
  const movimientos = movimientosData ?? [];

  const categorias = useMemo(() => Array.from(new Set(inventario.map((i) => i.categoria))), [inventario]);

  const filtered = inventario.filter((i) =>
    (cat === "todas" || i.categoria === cat) &&
    (!q || `${i.codigo} ${i.repuesto}`.toLowerCase().includes(q.toLowerCase()))
  );

  const alertas = inventario.filter((i) => i.estado === "Bajo" || i.estado === "Crítico" || i.estado === "Exceso");

  const allCodigos = useMemo(() => inventario.map((i) => i.codigo), [inventario]);
  const { data: predictions, loading: predLoading } = usePredictions(allCodigos);

  return (
    <>
      <TopBar title="Almacén" subtitle="Inventario, movimientos y alertas de stock" />
      <main className="flex-1 space-y-6 p-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { l: "SKUs activos", v: inventario.length, c: "text-primary" },
            { l: "Stock total", v: inventario.reduce((s, i) => s + i.stock, 0).toLocaleString(), c: "text-foreground" },
            { l: "Alertas críticas", v: inventario.filter((i) => i.estado === "Crítico").length, c: "text-destructive" },
            { l: "Stock en exceso", v: inventario.filter((i) => i.estado === "Exceso").length, c: "text-info" },
          ].map((m) => (
            <Card key={m.l}>
              <CardContent className="p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.l}</div>
                {invLoading
                  ? <Skeleton className="mt-2 h-7 w-20" />
                  : <div className={`mt-1 text-2xl font-semibold ${m.c}`}>{m.v}</div>
                }
              </CardContent>
            </Card>
          ))}
        </section>

        <Tabs defaultValue="inv">
          <TabsList>
            <TabsTrigger value="inv">Inventario</TabsTrigger>
            <TabsTrigger value="mov">Movimientos</TabsTrigger>
            <TabsTrigger value="alt">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="inv" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Catálogo de inventario</CardTitle>
                <Button size="sm"><ShoppingCart className="mr-2 h-4 w-4" /> Nueva orden de compra</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código o repuesto…" className="w-72 pl-8" />
                  </div>
                  <Select value={cat} onValueChange={setCat}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas las categorías</SelectItem>
                      {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Código</TableHead>
                        <TableHead>Repuesto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Mín</TableHead>
                        <TableHead className="text-right">Máx</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">
                          Demanda IA <span className="text-[10px] font-normal opacity-60">(90 d)</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invLoading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              {Array.from({ length: 8 }).map((__, j) => (
                                <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        : filtered.map((i) => (
                            <TableRow key={i.codigo}>
                              <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
                              <TableCell className="font-medium">{i.repuesto}</TableCell>
                              <TableCell>{i.categoria}</TableCell>
                              <TableCell className="text-right font-semibold">{i.stock}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{i.min}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{i.max}</TableCell>
                              <TableCell><Badge variant="outline" className={estadoStock[i.estado]}>{i.estado}</Badge></TableCell>
                              <TableCell className="text-right">
                                {predLoading ? (
                                  <Skeleton className="ml-auto h-4 w-14" />
                                ) : predictions[i.codigo] ? (
                                  <span>
                                    <span className="font-semibold">{predictions[i.codigo].cantidad_estimada}</span>
                                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                                      {Math.round(predictions[i.codigo].confianza * 100)}%
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mov" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Movimientos recientes</CardTitle>
                <CardDescription>Entradas desde órdenes de compra</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Código repuesto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Referencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movLoading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              {Array.from({ length: 5 }).map((__, j) => (
                                <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        : movimientos.map((m, i) => (
                            <TableRow key={i}>
                              <TableCell>{m.fecha}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1 text-success">
                                  <ArrowDownToLine className="h-3.5 w-3.5" /> Entrada
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{m.codigo}</TableCell>
                              <TableCell className="text-right font-semibold">{m.cant}</TableCell>
                              <TableCell className="text-muted-foreground">{m.ref}</TableCell>
                            </TableRow>
                          ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alt" className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {alertas.map((a) => (
                <Card key={a.codigo} className="border-l-4" style={{ borderLeftColor: a.estado === "Crítico" ? "#dc2626" : a.estado === "Bajo" ? "#f59e0b" : "#0288d1" }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-[11px] text-muted-foreground">{a.codigo}</div>
                        <div className="font-semibold">{a.repuesto}</div>
                        <div className="text-xs text-muted-foreground">{a.categoria}</div>
                      </div>
                      <AlertTriangle className={a.estado === "Crítico" ? "h-5 w-5 text-destructive" : a.estado === "Bajo" ? "h-5 w-5 text-warning" : "h-5 w-5 text-info"} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Stock: <b className="text-foreground">{a.stock}</b> / mín {a.min}</span>
                      <Badge variant="outline" className={estadoStock[a.estado]}>{a.estado}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
