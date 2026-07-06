// ──────────────────────────────────────────────────────────
//  Ruta publica: /reset-password
//  Recibe el token_hash del enlace del email de Supabase,
//  lo verifica con el SDK, y permite al usuario establecer
//  una nueva contrasena enviandola al backend.
// ──────────────────────────────────────────────────────────

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Gauge,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

// ── Definicion de la ruta ─────────────────────────────────
export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Restablecer contrasena — bpA Motors SCM" },
      {
        name: "description",
        content: "Establece una nueva contrasena para tu cuenta bpA Motors SCM.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    token_hash: (search["token_hash"] as string) ?? "",
    type: (search["type"] as string) ?? "",
    error: (search["error"] as string) ?? "",
    error_description: (search["error_description"] as string) ?? "",
  }),
  component: ResetPasswordPage,
});

// ── Schema de validacion ─────────────────────────────────
const schema = z
  .object({
    password: z
      .string()
      .min(8, "Minimo 8 caracteres.")
      .regex(/[0-9]/, "Debe contener al menos un numero.")
      .regex(/^[^;<>"']+$/, "Contiene caracteres no permitidos."),
    confirm: z.string().min(1, "Confirma tu nueva contrasena."),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contrasenas no coinciden.",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

// ── Componente principal ─────────────────────────────────
function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token_hash, type, error: urlError } = useSearch({ from: "/reset-password" });

  const [tokenState, setTokenState] = useState<"verifying" | "valid" | "invalid">("verifying");
  const [accessToken, setAccessToken] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  // ── Verificar el token al montar (Soporta Hash, Sesión y OTP) ──────────
  useEffect(() => {
    let active = true;

    const checkVerification = async () => {
      if (urlError) {
        if (active) setTokenState("invalid");
        return;
      }

      // 1. Verificar si ya tenemos una sesión activa (ej. PKCE flow auto-handled)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        if (active) {
          setAccessToken(session.access_token);
          setTokenState("valid");
        }
        return;
      }

      // 2. Verificar parámetros en el Hash Fragment (#access_token=...&type=recovery)
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1)); // Quitar el '#'
        const errorParam = params.get("error");
        const accessTokenParam = params.get("access_token");
        const typeParam = params.get("type");

        if (errorParam) {
          if (active) setTokenState("invalid");
          return;
        }

        if (accessTokenParam && (typeParam === "recovery" || hash.includes("recovery"))) {
          if (active) {
            setAccessToken(accessTokenParam);
            setTokenState("valid");
            // Sincronizar la sesión en el SDK cliente
            await supabase.auth.setSession({
              access_token: accessTokenParam,
              refresh_token: params.get("refresh_token") || "",
            });
          }
          return;
        }
      }

      // 3. Fallback: Verificar vía OTP (si la URL contiene ?token_hash=...)
      if (token_hash && type) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "recovery",
          });

          if (!active) return;

          if (error || !data.session) {
            setTokenState("invalid");
          } else {
            setAccessToken(data.session.access_token);
            setTokenState("valid");
          }
        } catch {
          if (active) setTokenState("invalid");
        }
        return;
      }

      // Si no se cumple ninguna condición, el token es inválido
      if (active) setTokenState("invalid");
    };

    checkVerification();

    return () => {
      active = false;
    };
  }, [token_hash, type, urlError]);

  // ── Enviar nueva contrasena al backend ──────────────────
  const onSubmit = async ({ password }: FormValues) => {
    if (!accessToken) return;
    setIsSubmitting(true);
    try {
      await authApi.confirmReset(accessToken, password);
      toast.success("Contrasena actualizada correctamente.");
      void navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al actualizar la contrasena.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl shadow-lg">
        {/* Header de marca */}
        <div className="bg-[#03369A] px-8 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
              <Gauge className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">bpA Motors</p>
              <p className="text-[11px] uppercase tracking-widest text-white/60">
                SCM INTELLIGENCE
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-white/80" />
            <h1 className="text-lg font-semibold">Restablecer contrasena</h1>
          </div>
        </div>

        {/* Cuerpo del card */}
        <div className="bg-white px-8 py-8">
          {/* Estado: verificando token */}
          {tokenState === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#03369A]" />
              <p className="text-sm text-gray-500">Verificando enlace...</p>
            </div>
          )}

          {/* Estado: token invalido */}
          {tokenState === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Enlace invalido o expirado</p>
                <p className="mt-1 text-sm text-gray-500">
                  Este enlace ya fue usado o ha expirado (valido por 1 hora). Solicita uno nuevo
                  desde la pantalla de inicio de sesion.
                </p>
              </div>
              <button
                id="back-to-login-btn"
                onClick={() => void navigate({ to: "/" })}
                className="mt-2 flex h-9 items-center gap-1.5 rounded-md bg-[#03369A] px-6 text-sm font-semibold text-white hover:opacity-90"
              >
                Volver al login
              </button>
            </div>
          )}

          {/* Estado: token valido — mostrar formulario */}
          {tokenState === "valid" && (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
              <div>
                <p className="text-sm text-gray-600">
                  Elige una nueva contrasena para tu cuenta. Debe tener al menos{" "}
                  <strong>8 caracteres</strong> y contener <strong>al menos un numero</strong>.
                </p>
              </div>

              {/* Campo: nueva contrasena */}
              <div className="flex flex-col gap-1">
                <label htmlFor="new-password" className="text-sm font-medium text-gray-700">
                  Nueva contrasena
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Minimo 8 caracteres"
                    maxLength={64}
                    {...register("password")}
                    className={[
                      "h-10 w-full rounded-md border px-3 pr-10 text-sm text-gray-900 outline-none",
                      "placeholder:text-gray-400 transition-colors duration-150",
                      "focus:border-[#03369A] focus:ring-2 focus:ring-[#03369A]/20",
                      errors.password
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "border-gray-300",
                    ].join(" ")}
                  />
                  <button
                    id="toggle-new-password"
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              {/* Campo: confirmar contrasena */}
              <div className="flex flex-col gap-1">
                <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                  Confirmar contrasena
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repite tu nueva contrasena"
                    maxLength={64}
                    {...register("confirm")}
                    className={[
                      "h-10 w-full rounded-md border px-3 pr-10 text-sm text-gray-900 outline-none",
                      "placeholder:text-gray-400 transition-colors duration-150",
                      "focus:border-[#03369A] focus:ring-2 focus:ring-[#03369A]/20",
                      errors.confirm
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "border-gray-300",
                    ].join(" ")}
                  />
                  <button
                    id="toggle-confirm-password"
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    aria-label={showConfirm ? "Ocultar contrasena" : "Mostrar contrasena"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirm && <p className="text-xs text-red-500">{errors.confirm.message}</p>}
              </div>

              {/* Indicador de requisitos */}
              <div className="rounded-md bg-blue-50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-blue-700">
                  <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Minimo 8 caracteres · Al menos 1 numero · Sin caracteres especiales de SQL
                  </span>
                </div>
              </div>

              {/* Boton de submit */}
              <button
                id="reset-password-submit-btn"
                type="submit"
                disabled={!isValid || isSubmitting}
                className={[
                  "flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition-all duration-150",
                  !isValid || isSubmitting
                    ? "cursor-not-allowed bg-gray-300 opacity-70"
                    : "cursor-pointer bg-[#03369A] hover:opacity-90 active:opacity-80",
                ].join(" ")}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSubmitting ? "Actualizando..." : "Establecer nueva contrasena"}
              </button>

              <button
                type="button"
                onClick={() => void navigate({ to: "/" })}
                className="text-center text-xs text-[#03369A] hover:underline"
              >
                Volver al inicio de sesion
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
