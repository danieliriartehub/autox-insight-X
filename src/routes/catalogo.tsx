import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Car, Package, Search, ChevronRight, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { vehiclesApi, partsApi } from "@/lib/api";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo Maestro | bpA Motors SCM" },
      { name: "description", content: "Maestros de vehículos y repuestos." },
    ],
  }),
  component: CatalogoPage,
});

function CatalogoPage() {
  const [qVeh, setQVeh] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const [pageParts, setPageParts] = useState(1);
  const [qParts, setQParts] = useState("");
  const [debouncedQParts, setDebouncedQParts] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQParts(qParts);
      setPageParts(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [qParts]);

  // Vehículos API
  const { data: brandsSummary, isLoading } = useQuery({
    queryKey: ["brands-summary"],
    queryFn: vehiclesApi.brandsSummary,
  });

  // Repuestos API
  const { data: partsResponse, isLoading: partsLoading } = useQuery({
    queryKey: ["parts", pageParts, debouncedQParts],
    queryFn: () => partsApi.list({ page: pageParts, page_size: 10, search: debouncedQParts || undefined }),
  });

  const { marcas, modelosPorMarca } = useMemo(() => {
    if (!brandsSummary) return { marcas: [], modelosPorMarca: new Map<string, { nombre: string; cantidad: number }[]>() };
    
    const map = new Map<string, { nombre: string; cantidad: number }[]>();
    const totals = new Map<string, number>();

    for (const item of brandsSummary) {
      if (!map.has(item.marca)) {
        map.set(item.marca, []);
        totals.set(item.marca, 0);
      }
      map.get(item.marca)!.push({ nombre: item.modelo, cantidad: item.cantidad_vehiculos });
      totals.set(item.marca, totals.get(item.marca)! + item.cantidad_vehiculos);
    }
    
    const marcasArray = Array.from(totals.entries())
      .map(([marca, total]) => ({ marca, total }))
      .sort((a, b) => a.marca.localeCompare(b.marca));

    return { marcas: marcasArray, modelosPorMarca: map };
  }, [brandsSummary]);

  useEffect(() => {
    if (marcas.length > 0 && !selectedBrand) {
      setSelectedBrand(marcas[0].marca);
    }
  }, [marcas, selectedBrand]);

  const filteredMarcas = marcas.filter(m => m.marca.toLowerCase().includes(qVeh.toLowerCase()));
  const selectedModelos = selectedBrand ? (modelosPorMarca.get(selectedBrand) || []) : [];

  const repuestos = partsResponse?.data ?? [];
  const partsMetadata = partsResponse?.metadata;
  const partsTotalPages = partsMetadata?.total_pages ?? 1;

  const PartsPaginationControls = () => (
    <div className="flex items-center gap-4">
      <span className="text-xs text-muted-foreground">
        {partsMetadata ? `Página ${partsMetadata.current_page} de ${partsMetadata.total_pages}` : "Página 1 de 1"}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setPageParts((p) => Math.max(1, p - 1))}
          disabled={pageParts <= 1 || partsLoading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setPageParts((p) => Math.min(partsTotalPages, p + 1))}
          disabled={pageParts >= partsTotalPages || partsLoading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <TopBar title="Catálogo Maestro" subtitle="Vehículos y repuestos" />
      <main className="flex-1 space-y-6 p-6">
        <Tabs defaultValue="veh" className="h-full">
          <TabsList>
            <TabsTrigger value="veh"><Car className="mr-1.5 h-4 w-4" /> Vehículos</TabsTrigger>
            <TabsTrigger value="rep"><Package className="mr-1.5 h-4 w-4" /> Repuestos</TabsTrigger>
          </TabsList>

          <TabsContent value="veh" className="mt-4">
            <Card className="h-[calc(100vh-14rem)] min-h-[500px] overflow-hidden flex flex-col">
              <CardHeader className="pb-4 shrink-0">
                <CardTitle className="text-base">Catálogo de Vehículos por Marca</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <div className="grid h-full grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-t">
                  
                  {/* Panel Izquierdo: Marcas */}
                  <div className="flex flex-col h-full bg-muted/10 md:col-span-1 overflow-hidden">
                    <div className="p-3 border-b shrink-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input 
                          value={qVeh} 
                          onChange={(e) => setQVeh(e.target.value)} 
                          placeholder="Buscar marca…" 
                          className="pl-8 h-8" 
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {isLoading ? (
                        <div className="p-4 space-y-3">
                           {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                      ) : filteredMarcas.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          No se encontraron marcas.
                        </div>
                      ) : (
                         <ul className="divide-y">
                           {filteredMarcas.map(m => (
                             <li 
                               key={m.marca} 
                               onClick={() => setSelectedBrand(m.marca)}
                               className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors flex justify-between items-center ${
                                 selectedBrand === m.marca 
                                  ? 'bg-primary/5 border-l-2 border-l-primary' 
                                  : 'border-l-2 border-l-transparent'
                               }`}
                             >
                               <span className="font-medium text-sm">{m.marca}</span>
                               <div className="flex items-center gap-2">
                                 <Badge variant="secondary" className="font-mono text-[10px] px-1.5">{m.total}</Badge>
                                 <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                               </div>
                             </li>
                           ))}
                         </ul>
                      )}
                    </div>
                  </div>

                  {/* Panel Derecho: Modelos */}
                  <div className="flex flex-col h-full md:col-span-2 overflow-hidden">
                    <div className="p-4 border-b bg-muted/5 flex justify-between items-center shrink-0">
                       <h3 className="font-semibold text-primary">{selectedBrand || "Selecciona una marca"}</h3>
                       <span className="text-xs text-muted-foreground">{selectedModelos.length} modelos registrados</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                       {selectedBrand ? (
                         <Table>
                           <TableHeader className="sticky top-0 bg-background/95 backdrop-blur shadow-sm z-10">
                             <TableRow className="hover:bg-transparent">
                               <TableHead>Modelo</TableHead>
                               <TableHead className="text-right">Vehículos</TableHead>
                             </TableRow>
                           </TableHeader>
                           <TableBody>
                             {selectedModelos.sort((a,b) => b.cantidad - a.cantidad).map((m, i) => (
                               <TableRow key={`${m.nombre}-${i}`}>
                                 <TableCell className="font-medium text-muted-foreground">{m.nombre}</TableCell>
                                 <TableCell className="text-right font-mono text-muted-foreground">{m.cantidad}</TableCell>
                               </TableRow>
                             ))}
                             {selectedModelos.length === 0 && (
                               <TableRow>
                                 <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                   No hay modelos registrados para esta marca.
                                 </TableCell>
                               </TableRow>
                             )}
                           </TableBody>
                         </Table>
                       ) : (
                         <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                           Selecciona una marca del panel lateral.
                         </div>
                       )}
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rep" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
                <CardTitle className="text-base">Catálogo de Repuestos</CardTitle>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      value={qParts} 
                      onChange={(e) => setQParts(e.target.value)} 
                      placeholder="Buscar código, desc. o marca…" 
                      className="pl-8 h-9" 
                    />
                  </div>
                  <div className="hidden sm:block">
                    <PartsPaginationControls />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-32 whitespace-nowrap">Código</TableHead>
                        <TableHead className="min-w-[250px] whitespace-nowrap">Descripción</TableHead>
                        <TableHead className="w-48 whitespace-nowrap">Marca</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partsLoading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          </TableRow>
                        ))
                      ) : repuestos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                            No se encontraron repuestos.
                          </TableCell>
                        </TableRow>
                      ) : (
                        repuestos.map((r) => (
                          <TableRow key={r.c_repuesto}>
                            <TableCell className="font-mono text-xs font-medium text-primary whitespace-nowrap">{r.c_repuesto}</TableCell>
                            <TableCell>{r.descripcion}</TableCell>
                            <TableCell className="whitespace-nowrap">{r.marca || "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-between items-center mt-4 sm:justify-end">
                  <div className="text-xs text-muted-foreground sm:hidden">
                    {partsMetadata?.total_records} repuestos
                  </div>
                  <PartsPaginationControls />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
