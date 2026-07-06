// ──────────────────────────────────────────────────────────
//  Componente: Modal "Olvidaste tu contraseña"
//  Permite al usuario solicitar un email de recuperacion.
//  Usa el endpoint POST /api/v1/auth/request-reset del backend.
// ──────────────────────────────────────────────────────────

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, SendHorizonal, CheckCircle2, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

// ── Schema de validacion ─────────────────────────────────
const schema = z.object({
  email: z
    .string()
    .email({ message: "Introduce un correo electronico valido." })
    .max(100, { message: "El correo excede la longitud permitida." }),
});

type FormValues = z.infer<typeof schema>;

// ── Props ────────────────────────────────────────────────
interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Componente ───────────────────────────────────────────
export function ForgotPasswordModal({ open, onOpenChange }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<"form" | "sent">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const handleClose = (value: boolean) => {
    if (!value) {
      // Reset al cerrar
      setStep("form");
      reset();
    }
    onOpenChange(value);
  };

  const onSubmit = async ({ email }: FormValues) => {
    setIsSubmitting(true);
    try {
      await authApi.requestReset(email);
      // Siempre mostrar exito (backend no revela si el email existe)
      setStep("sent");
    } catch {
      // En caso de error de red inesperado
      toast.error("No se pudo enviar el correo. Verifica tu conexion e intentalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Recuperar contrasena
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {step === "form"
              ? "Ingresa tu correo corporativo y te enviaremos un enlace para restablecer tu contrasena."
              : "Revisa tu bandeja de entrada."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-2 flex flex-col gap-4" noValidate>
            {/* Campo Email */}
            <div className="flex flex-col gap-1">
              <label htmlFor="reset-email" className="text-sm font-medium text-gray-700">
                Correo corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="usuario@bpamotors.com"
                  {...register("email")}
                  className={[
                    "h-10 w-full rounded-md border pl-10 pr-3 text-sm text-gray-900 outline-none",
                    "placeholder:text-gray-400 transition-colors duration-150",
                    "focus:border-[#03369A] focus:ring-2 focus:ring-[#03369A]/20",
                    errors.email
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-gray-300",
                  ].join(" ")}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="flex h-9 items-center gap-1.5 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
              <button
                id="send-reset-btn"
                type="submit"
                disabled={!isValid || isSubmitting}
                className={[
                  "flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-semibold text-white transition-all duration-150",
                  !isValid || isSubmitting
                    ? "cursor-not-allowed bg-gray-300 opacity-70"
                    : "cursor-pointer bg-[#03369A] hover:opacity-90 active:opacity-80",
                ].join(" ")}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
                {isSubmitting ? "Enviando..." : "Enviar enlace"}
              </button>
            </div>
          </form>
        ) : (
          /* Pantalla de confirmacion */
          <div className="mt-2 flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Correo enviado</p>
              <p className="mt-1 text-sm text-gray-500">
                Si tu correo esta registrado, recibiras un enlace en los proximos minutos. Revisa
                tambien tu carpeta de spam.
              </p>
            </div>
            <button
              id="close-reset-confirm-btn"
              onClick={() => handleClose(false)}
              className="mt-2 flex h-9 items-center gap-1.5 rounded-md bg-[#03369A] px-6 text-sm font-semibold text-white hover:opacity-90"
            >
              Entendido
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
