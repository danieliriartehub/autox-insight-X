/**
 * Cliente HTTP centralizado para el backend de autox-insight.
 *
 * Seguridad:
 * - credentials: "include" envía automáticamente la cookie HttpOnly
 *   en cada petición — el frontend nunca necesita leer ni almacenar el token.
 * - La URL base proviene de la variable de entorno VITE_API_URL, nunca
 *   hardcodeada en el código fuente.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export interface UserPublic {
  correo_corporativo: string;
  nombre_completo: string;
  cargo: string;
}

export interface LoginResponse {
  message: string;
  user: UserPublic;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include", // ← siempre envía las cookies HttpOnly
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    // Intenta leer el mensaje de error del backend
    let detail = `Error ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // si el body no es JSON, usamos el status code
    }
    throw new Error(detail);
  }

  // 204 No Content u otros sin body
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ── Endpoints de autenticación ────────────────────────────────────────────────

export const authApi = {
  /** POST /api/v1/auth/login — recibe credenciales, setea cookie HttpOnly */
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  /** GET /api/v1/auth/me — verifica cookie y devuelve perfil (para rehidratar sesión) */
  me: () => apiFetch<UserPublic>("/api/v1/auth/me"),

  /** POST /api/v1/auth/logout — elimina la cookie HttpOnly */
  logout: () =>
    apiFetch<{ message: string }>("/api/v1/auth/logout", { method: "POST" }),
};
