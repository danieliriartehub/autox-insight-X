// ── Página de Taller — Órdenes de Trabajo ─────────────────────────────────────
// Lista paginada de OTs con búsqueda, filtro por estado,
// selección de una OT y detalle de repuestos consumidos.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { workOrdersApi } from "@/lib/api";

// ── Definición de ruta ────────────────────────────────────────────────────────

export const Route = createFileRoute("/taller")({
  head: () => ({
    meta: [
      { title: "Taller — Órdenes de Trabajo | bpA Motors SCM" },
      {
        name: "description",
        content: "Gestión de órdenes de trabajo, servicios y consumo de repuestos.",
      },
    ],
  }),
  component: TallerPage,
});

// ── Colores semánticos por código de estado de OT ──────────────────────────────
// S-Series (verdes) = estados de salida/cierre
// I-Series (azules) = estados de ingreso/reingreso
const estadoColor: Record<string, string> = {
  S9: "bg-green-600/30 text-green-800 border-green-600/50", // Cerrada
  S7: "bg-green-500/25 text-green-700 border-green-500/40", // Pendiente de factura
  S6: "bg-green-500/20 text-green-700 border-green-500/30", // Pendiente atención y factura
  S2: "bg-green-400/15 text-green-700 border-green-400/30", // Salida x Traslado
  S1: "bg-green-400/10 text-green-600 border-green-400/20", // Pendiente de atencion
  I9: "bg-blue-600/30 text-blue-800 border-blue-600/50", // Reabierta uso total
  I2: "bg-blue-500/25 text-blue-700 border-blue-500/40", // Ingreso x traslado
  I1: "bg-blue-500/20 text-blue-700 border-blue-500/30", // Reabierta (reingreso)
  I0: "bg-blue-400/15 text-blue-600 border-blue-400/30", // Abierta regular
};

// ── Helper: color de badge según código de estado ──────────────────────────────

function getColorByEstado(c?: string): string {
  if (!c) return "bg-gray-100 text-gray-800 border-gray-200";
  return estadoColor[c] || "bg-gray-100 text-gray-800 border-gray-200";
}

// ── Controles de paginación (componente puro fuera de TallerPage) ────────────

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  metadata?: { current_page: number; total_pages: number } | null;
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
  isLoading,
  metadata,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-muted-foreground">
        {metadata ? `Página ${metadata.current_page} de ${metadata.total_pages}` : "Página 1 de 1"}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || isLoading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

function TallerPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [estado, setEstado] = useState<string>("todos");
  const [selectedId, setSelectedId] = useState<string>("");

  // Debounce de búsqueda: espera 400ms antes de disparar la consulta
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  // Al cambiar filtro de estado, regresa a página 1
  useEffect(() => {
    setPage(1);
  }, [estado]);

  // Consulta paginada de órdenes de trabajo desde la API backend
  const { data: response, isLoading } = useQuery({
    queryKey: ["work-orders", page, debouncedQ, estado],
    queryFn: () =>
      workOrdersApi.list({
        page,
        page_size: 10,
        search: debouncedQ || undefined,
        c_estado: estado === "todos" ? undefined : estado,
      }),
  });

  const ordenes = response?.data ?? [];
  const metadata = response?.metadata;
  const totalPages = metadata?.total_pages ?? 1;

  // Selección: usa el ID guardado o la primera OT como fallback
  const selected = ordenes.find((o) => `OT-${o.n_ot}` === selectedId) ?? ordenes[0];
  const selectedUiId = selected ? `OT-${selected.n_ot}` : "";

  // Detalle de repuestos de la OT seleccionada
  const { data: detalle, isLoading: detalleLoading } = useQuery({
    queryKey: ["work-order-parts", selectedUiId],
    queryFn: () => workOrdersApi.parts(selectedUiId),
    enabled: !!selectedUiId,
  });

  return (
    <>
      <TopBar title="Taller" subtitle="Órdenes de trabajo y consumo de repuestos" />
      <main className="flex-1 space-y-6 p-6">
        <Card>
          {/* ── Encabezado ───────────────────────────────────────────── */}
          <CardHeader>
            <CardTitle className="text-base">Órdenes de Trabajo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ── Filtros: búsqueda + estado + contador ──────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar OT, cliente, vehículo…"
                    className="w-72 pl-8"
                  />
                </div>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="I0">Abierta (Modo Regular)</SelectItem>
                    <SelectItem value="I1">Reabierta (Reingreso)</SelectItem>
                    <SelectItem value="I2">Ingreso x Traslado</SelectItem>
                    <SelectItem value="I9">Reabierta Uso Total</SelectItem>
                    <SelectItem value="S1">Pendiente de Atención</SelectItem>
                    <SelectItem value="S2">Salida x Traslado</SelectItem>
                    <SelectItem value="S6">Pendiente Atn. y Factura</SelectItem>
                    <SelectItem value="S7">Pendiente de Factura</SelectItem>
                    <SelectItem value="S9">Cerrada</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  {metadata?.total_records !== undefined ? `${metadata.total_records} órdenes` : ""}
                </div>
              </div>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                isLoading={isLoading}
                metadata={metadata}
              />
            </div>

            {/* ── Tabla de órdenes de trabajo ─────────────────────────── */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="whitespace-nowrap">Número OT</TableHead>
                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                    <TableHead className="whitespace-nowrap">Placa</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[250px]">Requerimiento</TableHead>
                    <TableHead className="whitespace-nowrap">Tipo</TableHead>
                    <TableHead className="whitespace-nowrap">Estado Auto</TableHead>
                    <TableHead className="whitespace-nowrap">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    // Skeletons durante la carga
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full min-w-[100px]" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : ordenes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No se encontraron resultados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Filas de datos
                    ordenes.map((o) => {
                      const uiId = `OT-${o.n_ot}`;
                      const cEstado = o.estado?.c_estado || "";
                      const badgeColor = getColorByEstado(cEstado);
                      // Clasificación: I-serie = en taller, S-serie = salió
                      const estadoAuto = cEstado.startsWith("I")
                        ? "En Taller"
                        : cEstado.startsWith("S")
                          ? "Salió del Taller"
                          : "—";

                      return (
                        <TableRow
                          key={o.n_ot}
                          onClick={() => setSelectedId(uiId)}
                          className="cursor-pointer hover:bg-muted/40 data-[active=true]:bg-primary/5"
                          data-active={selectedUiId === uiId}
                        >
                          <TableCell className="font-medium text-primary whitespace-nowrap">
                            {uiId}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {o.fecha ? String(o.fecha).split("T")[0] : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {o.auto?.placa ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                            {o.requerimiento ? o.requerimiento.slice(0, 45) : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {o.tipo_ot_desc ?? "Otro"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={
                                estadoAuto === "En Taller"
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {estadoAuto}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className={badgeColor}>
                              {o.estado?.descripcion ?? cEstado}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-2">
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                isLoading={isLoading}
                metadata={metadata}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Detalle de la OT seleccionada ──────────────────────────── */}
        {selected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Detalle de {selectedUiId} · Placa {selected.auto?.placa ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Columna izquierda: repuestos consumidos */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Repuestos utilizados
                </h4>
                {detalleLoading ? (
                  <div className="mt-2 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {(detalle ?? []).length === 0 ? (
                      <li className="text-xs text-muted-foreground">Sin repuestos registrados</li>
                    ) : (
                      (detalle ?? []).map((r) => (
                        <li key={r.id} className="flex justify-between border-b border-dashed py-1">
                          <span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.producto_id}
                            </span>{" "}
                            · {r.descripcion}
                          </span>
                          <span className="font-medium">x{r.cantidad}</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              {/* Columna derecha: requerimiento del cliente */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Requerimiento
                </h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selected.requerimiento ?? "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
