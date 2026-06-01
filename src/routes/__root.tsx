import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth, canAccess } from "@/lib/auth";
import { ShieldAlert } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página no encontrada</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Ir al Dashboard
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Algo salió mal</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Motors SCM Intelligence Platform" },
      { name: "description", content: "Plataforma de Supply Chain Management con analítica avanzada y predicción de demanda para taller automotriz multimarca." },
      { property: "og:title", content: "Motors SCM Intelligence Platform" },
      { name: "twitter:title", content: "Motors SCM Intelligence Platform" },
      { property: "og:description", content: "Plataforma de Supply Chain Management con analítica avanzada y predicción de demanda para taller automotriz multimarca." },
      { name: "twitter:description", content: "Plataforma de Supply Chain Management con analítica avanzada y predicción de demanda para taller automotriz multimarca." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1fe10060-08f5-4789-8fef-856f1dcab2df/id-preview-26acca27--b5cace11-ce3d-4c0a-b104-fcd873ffc7d0.lovable.app-1780201597115.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1fe10060-08f5-4789-8fef-856f1dcab2df/id-preview-26acca27--b5cace11-ce3d-4c0a-b104-fcd873ffc7d0.lovable.app-1780201597115.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const { user, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!ready) return;
    if (!user && !isLogin) navigate({ to: "/login" });
  }, [ready, user, isLogin, navigate]);

  // Public/auth route — render Outlet only (no sidebar chrome)
  if (isLogin || !user) {
    return <Outlet />;
  }

  const allowed = canAccess(user.rol, pathname);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          {allowed ? <Outlet /> : <Forbidden />}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function Forbidden() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 text-lg font-semibold text-foreground">Acceso restringido</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu rol no tiene permisos para acceder a este módulo.
        </p>
        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Volver al Dashboard
        </button>
      </div>
    </div>
  );
}
