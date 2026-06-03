import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Gauge,
  ShieldCheck,
  Eye,
  EyeOff,
  LogIn,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — bpA Motors SCM" },
      {
        name: "description",
        content:
          "Accede con tus credenciales corporativas al sistema de inteligencia operativa bpA Motors.",
      },
    ],
  }),
  component: LoginPage,
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const validateEmail = () => {
    const invalid = !EMAIL_REGEX.test(email);
    setEmailError(invalid);
    return !invalid;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateEmail()) return;
    void navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4">
      <div className="flex w-full max-w-5xl overflow-hidden rounded-xl shadow-lg">

        {/* ── Panel Izquierdo: Branding ── */}
        <div className="hidden w-1/2 flex-col justify-between bg-[#03369A] p-12 text-white lg:flex">

          {/* Header del panel */}
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

          {/* Cuerpo del panel */}
          <div>
            <h1 className="mb-4 text-4xl font-bold leading-tight">
              Inteligencia operativa para tu taller multimarca.
            </h1>
            <p className="text-lg text-blue-100">
              Predicción de demanda, control de inventario y trazabilidad
              end-to-end.
            </p>
          </div>

          {/* Footer del panel */}
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-white/80" />
              <span className="text-sm font-bold">Acceso seguro por rol</span>
            </div>
            <p className="mt-1 text-xs text-white/50">
              bPA Motors · Surquillo
            </p>
          </div>
        </div>

        {/* ── Panel Derecho: Formulario ── */}
        <div className="flex w-full flex-col justify-center bg-white p-12 lg:w-1/2">

          {/* Cabecera del formulario */}
          <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
          <p className="mb-8 mt-1 text-sm text-gray-500">
            Ingresa con tus credenciales corporativas.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

            {/* Campo Email */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="login-email"
                className="text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="usuario@bpamotors.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(false);
                }}
                onBlur={validateEmail}
                className={[
                  "h-10 w-full rounded-md border px-3 text-sm text-gray-900 outline-none",
                  "placeholder:text-gray-400 transition-colors duration-150",
                  "focus:border-[#03369A] focus:ring-2 focus:ring-[#03369A]/20",
                  emailError
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-gray-300",
                ].join(" ")}
              />
              {emailError && (
                <p className="text-xs text-red-500">
                  Introduce un correo electrónico válido.
                </p>
              )}
            </div>

            {/* Campo Contraseña */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="login-password"
                className="text-sm font-medium text-gray-700"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={[
                    "h-10 w-full rounded-md border border-gray-300 px-3 pr-10",
                    "text-sm text-gray-900 outline-none placeholder:text-gray-400",
                    "transition-colors duration-150",
                    "focus:border-[#03369A] focus:ring-2 focus:ring-[#03369A]/20",
                  ].join(" ")}
                />
                <button
                  id="toggle-password-visibility"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Link ¿Olvidaste tu contraseña? */}
            <div className="flex justify-end">
              <a
                id="forgot-password-link"
                href="#"
                className="cursor-pointer text-xs text-[#03369A] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {/* Botón de Acción */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={!email || !password || !EMAIL_REGEX.test(email)}
              className={[
                "mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition-all duration-150",
                (!email || !password || !EMAIL_REGEX.test(email))
                  ? "bg-gray-300 cursor-not-allowed opacity-70"
                  : "bg-[#03369A] cursor-pointer hover:opacity-90 active:opacity-80",
              ].join(" ")}
            >
              <LogIn className="h-4 w-4" />
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
