// ──────────────────────────────────────────────────────────
//  Componente: Barra lateral de navegación (Sidebar)
//  Menú principal de la aplicación con enlaces a todas las
//  secciones y botón de cierre de sesión.
// ──────────────────────────────────────────────────────────

import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wrench,
  Warehouse,
  BookOpen,
  BarChart3,
  Brain,
  Gauge,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

// Definición de los elementos de navegación
const items = [
  { title: "Dashboard Ejecutivo", url: "/dashboard", icon: LayoutDashboard },
  { title: "Taller", url: "/taller", icon: Wrench },
  { title: "Almacén", url: "/almacen", icon: Warehouse },
  { title: "Catálogo Maestro", url: "/catalogo", icon: BookOpen },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "IA Predictiva", url: "/prediccion", icon: Brain },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    void navigate({ to: "/" });
  };

  return (
    <Sidebar collapsible="icon">
      {/* Encabezado con logo y nombre del sistema */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Gauge className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-sidebar-foreground">bpA Motors</span>
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              SCM Intelligence
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Menú de navegación */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer con botón de cerrar sesión */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <button
          onClick={handleLogout}
          className="flex w-full hover:cursor-pointer items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar Sesión</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
