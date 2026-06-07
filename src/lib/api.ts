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

// ── Endpoints de Órdenes de Trabajo ───────────────────────────────────────────

export interface EstadoOT {
  c_estado: string;
  descripcion?: string;
}

export interface AutoInfo {
  vin: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  anio_mod?: number;
  tipo_transmision?: string;
  tipo_combustible?: string;
}

export interface WorkOrderItem {
  n_ot: string;
  fecha?: string;
  km?: number;
  rango_km?: string;
  tipo_ot_desc?: string;
  requerimiento?: string;
  dias_atencion?: number;
  estado?: EstadoOT;
  auto?: AutoInfo;
}

export interface WorkOrderMetadata {
  total_records: number;
  current_page: number;
  page_size: number;
  total_pages: number;
}

export interface WorkOrderListResponse {
  metadata: WorkOrderMetadata;
  data: WorkOrderItem[];
}

export interface WorkOrderPart {
  id: number;
  producto_id?: string;
  descripcion?: string;
  marca?: string;
  cantidad?: number;
  precio_unitario?: number;
  total?: number;
  c_moneda?: string;
}

export const workOrdersApi = {
  list: async (params: {
    page?: number;
    page_size?: number;
    search?: string;
    c_estado?: string;
    marca?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.page_size) searchParams.append("page_size", params.page_size.toString());
    if (params.search) searchParams.append("search", params.search);
    if (params.c_estado && params.c_estado !== "todos") searchParams.append("c_estado", params.c_estado);
    if (params.marca) searchParams.append("marca", params.marca);

    const query = searchParams.toString();
    const url = `/api/v1/work-orders${query ? `?${query}` : ""}`;
    return apiFetch<WorkOrderListResponse>(url);
  },

  parts: async (nOt: string) => {
    // nOt is passed as OT-123, extract just the number or if it's already a number use it
    const otNum = nOt.replace("OT-", "");
    return apiFetch<WorkOrderPart[]>(`/api/v1/work-orders/${otNum}/parts`);
  },
};
