import { createFileRoute } from "@tanstack/react-router";
import { Car, Wrench, AlertCircle, Package } from "lucide-react";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  vehiculosCatalogo, fallasCatalogo, serviciosCatalogo, inventario,
} from "@/lib/mock-data";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo Maestro | bpA Motors SCM" },
      { name: "description", content: "Maestros de vehículos, repuestos, fallas y servicios." },
    ],
  }),
  component: CatalogoPage,
});

function CatalogoPage() {
  return (
    <>
      <TopBar title="Catálogo Maestro" subtitle="Vehículos, repuestos, fallas y servicios" />
      <main className="flex-1 space-y-6 p-6">
        <Tabs defaultValue="veh">
          <TabsList>
            <TabsTrigger value="veh"><Car className="mr-1.5 h-4 w-4" /> Vehículos</TabsTrigger>
            <TabsTrigger value="rep"><Package className="mr-1.5 h-4 w-4" /> Repuestos</TabsTrigger>
            <TabsTrigger value="fal"><AlertCircle className="mr-1.5 h-4 w-4" /> Fallas</TabsTrigger>
            <TabsTrigger value="ser"><Wrench className="mr-1.5 h-4 w-4" /> Servicios</TabsTrigger>
          </TabsList>

          <TabsContent value="veh" className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vehiculosCatalogo.map((v) => (
                <Card key={v.marca}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-primary">{v.marca}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {v.modelos.map((m) => (
                      <Badge key={m} variant="secondary" className="font-normal">{m}</Badge>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rep" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Maestro de repuestos</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Marca</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventario.map((r) => (
                        <TableRow key={r.codigo}>
                          <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                          <TableCell className="font-medium">{r.repuesto}</TableCell>
                          <TableCell>{r.categoria}</TableCell>
                          <TableCell>{r.marca}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fal" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Catálogo de fallas</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fallasCatalogo.map((f) => (
                        <TableRow key={f.codigo}>
                          <TableCell className="font-mono text-xs">{f.codigo}</TableCell>
                          <TableCell>{f.desc}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ser" className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {serviciosCatalogo.map((s) => (
                <Card key={s.tipo}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-primary">{s.tipo}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm">
                      {s.items.map((it) => (
                        <li key={it} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{it}</li>
                      ))}
                    </ul>
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
