// ── Utilidad: cn ──────────────────────────────────────────────────────────────
// Combina clases de Tailwind con clsx y resuelve conflictos via tailwind-merge.
// Es el estándar de shadcn/ui para componer className condicionalmente.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
