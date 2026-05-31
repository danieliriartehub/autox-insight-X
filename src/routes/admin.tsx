import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Settings2, Shield } from "lucide-react";

import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { usuarios } from "@/lib/mock-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administración | bpA Motors SCM" },
      { name: "description", content: "Gestión de usuarios, roles y configuración del modelo predictivo." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [users, setUsers] = useState(usuarios);
  const [horizonte, setHorizonte] = useState([90]);
  const [umbral, setUmbral] = useState([85]);

  return (
    <>
      <TopBar title="Administración" subtitle="Usuarios, roles y configuración del modelo IA" />
      <main className="flex-1 space-y-6 p-6">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Usuarios</TabsTrigger>
            <TabsTrigger value="roles">Roles y Permisos</TabsTrigger>
            <TabsTrigger value="model">Modelo IA</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Usuarios de la plataforma</CardTitle>
                  <CardDescription>{users.filter((u) => u.activo).length} activos · {users.length} totales</CardDescription>
                </div>
                <Button size="sm"><UserPlus className="mr-2 h-4 w-4" /> Crear usuario</Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.nombre}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell><Badge variant="secondary">{u.rol}</Badge></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={u.activo ? "border-success/40 bg-success/10 text-success" : "border-muted-foreground/30 text-muted-foreground"}>
                              {u.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={u.activo}
                              onCheckedChange={(c) => setUsers(users.map((x) => x.id === u.id ? { ...x, activo: c } : x))}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { rol: "Administrador", perms: ["Gestionar usuarios", "Configurar IA", "Ver dashboards ejecutivos", "Acceso total"], color: "border-primary/40 bg-primary/5" },
                { rol: "Jefe de Taller", perms: ["Ver órdenes de trabajo", "Analizar demanda de servicios", "Analizar consumo de repuestos"], color: "border-info/40 bg-info/5" },
                { rol: "Jefe de Almacén", perms: ["Gestionar inventario", "Gestionar órdenes de compra", "Alertas de stock"], color: "border-success/40 bg-success/5" },
              ].map((r) => (
                <Card key={r.rol} className={`border-l-4 ${r.color}`}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> {r.rol}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm">
                      {r.perms.map((p) => (
                        <li key={p} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{p}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="model" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Parámetros del modelo predictivo</CardTitle>
                <CardDescription>Ajusta horizonte, umbrales y variables consideradas</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>Horizonte de predicción: <b>{horizonte[0]} días</b></Label>
                  <Slider value={horizonte} onValueChange={setHorizonte} min={30} max={180} step={15} />
                  <p className="text-xs text-muted-foreground">Define el periodo futuro proyectado por el modelo.</p>
                </div>
                <div className="space-y-3">
                  <Label>Umbral de confianza mínimo: <b>{umbral[0]}%</b></Label>
                  <Slider value={umbral} onValueChange={setUmbral} min={50} max={99} step={1} />
                  <p className="text-xs text-muted-foreground">Recomendaciones por debajo del umbral se marcan como revisión manual.</p>
                </div>
                <div className="md:col-span-2 space-y-3">
                  <Label>Variables activas</Label>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      "Historial OT", "Consumo histórico", "Marca", "Modelo",
                      "Año vehículo", "Estacionalidad", "Mantenimiento", "Lead time",
                    ].map((v, i) => (
                      <div key={v} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm">{v}</span>
                        <Switch defaultChecked={i < 7} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button variant="outline">Restablecer</Button>
                  <Button>Guardar y reentrenar</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
