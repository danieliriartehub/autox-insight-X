import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gauge, LogIn, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEMO_USERS, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión | bpA Motors SCM" },
      { name: "description", content: "Acceso a la plataforma SCM Intelligence." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = login(email, password);
    setLoading(false);
    if (!res.ok) setError(res.error);
    else navigate({ to: "/" });
  }

  function quickLogin(em: string) {
    setEmail(em);
    setPassword("demo123");
    const res = login(em, "demo123");
    if (res.ok) navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-primary/10 via-background to-background flex items-center justify-center p-4">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between rounded-2xl bg-primary p-8 text-primary-foreground">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/15">
                <Gauge className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-semibold">bpA Motors</div>
                <div className="text-[11px] uppercase tracking-wider opacity-80">SCM Intelligence</div>
              </div>
            </div>
            <h2 className="mt-10 text-3xl font-semibold leading-tight">
              Inteligencia operativa para tu taller multimarca.
            </h2>
            <p className="mt-3 text-sm opacity-85">
              Predicción de demanda, control de inventario y trazabilidad end-to-end.
            </p>
          </div>
          <div className="space-y-2 text-xs opacity-85">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Acceso seguro por rol</div>
            <div>USIL · bPA Motors · Surquillo</div>
          </div>
        </div>

        {/* Form */}
        <Card className="border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>Ingresa con tus credenciales corporativas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@bpamotors.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" />
              </div>
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="mr-2 h-4 w-4" /> Entrar
              </Button>
            </form>

            <div className="mt-6 border-t pt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Usuarios de demostración
              </div>
              <div className="space-y-2">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => quickLogin(u.email)}
                    className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div>
                      <div className="font-medium">{u.nombre}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <Badge variant="secondary">{u.rolLabel}</Badge>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Contraseña común: <code className="rounded bg-muted px-1">demo123</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
