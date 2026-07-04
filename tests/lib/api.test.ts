// ── Pruebas del cliente HTTP centralizado (api.ts) ───────────────────────────
// Verifica construcción de URLs, headers, manejo de errores, edge cases
// de respuesta (204 No Content, body no JSON, detail del backend).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi, workOrdersApi, partsApi } from "@/lib/api";

const g = globalThis as unknown as { fetch: ReturnType<typeof vi.fn> };

function mockFetchResponse(body: unknown, status = 200, contentType = "application/json") {
  const headers = new Headers({ "content-type": contentType });
  g.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
  });
}

function mockFetchNoContent() {
  const headers = new Headers();
  g.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    headers,
    json: async () => {
      throw new Error("no body");
    },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── authApi ───────────────────────────────────────────────────────────────────

describe("authApi", () => {
  it("login envía POST con email y password", async () => {
    const fakeUser = { correo_corporativo: "a@b.com", nombre_completo: "A", cargo: "B" };
    mockFetchResponse({ message: "ok", user: fakeUser });
    const res = await authApi.login("a@b.com", "pass123");
    expect(g.fetch).toHaveBeenCalledOnce();
    const [url, opts] = g.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/auth/login");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({ email: "a@b.com", password: "pass123" });
    expect(res.user.nombre_completo).toBe("A");
  });

  it("me ejecuta GET /me", async () => {
    mockFetchResponse({ correo_corporativo: "a@b.com", nombre_completo: "A", cargo: "B" });
    const res = await authApi.me();
    const [url] = g.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/auth/me");
    expect(res.nombre_completo).toBe("A");
  });

  it("logout ejecuta POST", async () => {
    mockFetchResponse({ message: "ok" });
    await authApi.logout();
    const [, opts] = g.fetch.mock.calls[0];
    expect(opts.method).toBe("POST");
  });
});

// ── workOrdersApi ─────────────────────────────────────────────────────────────

describe("workOrdersApi", () => {
  const fakeList = {
    metadata: { total_records: 100, current_page: 1, page_size: 10, total_pages: 10 },
    data: [{ n_ot: "OT-001" }],
  };

  it("list construye URL con todos los parámetros", async () => {
    mockFetchResponse(fakeList);
    await workOrdersApi.list({
      page: 2,
      page_size: 20,
      search: "freno",
      c_estado: "P",
      marca: "Toyota",
    });
    const [url] = g.fetch.mock.calls[0];
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=20");
    expect(url).toContain("search=freno");
    expect(url).toContain("c_estado=P");
    expect(url).toContain("marca=Toyota");
  });

  it("list omite c_estado si es 'todos'", async () => {
    mockFetchResponse(fakeList);
    await workOrdersApi.list({ c_estado: "todos" });
    const [url] = g.fetch.mock.calls[0];
    expect(url).not.toContain("c_estado");
  });

  it("list funciona sin parámetros", async () => {
    mockFetchResponse(fakeList);
    const res = await workOrdersApi.list();
    expect(res.metadata.total_records).toBe(100);
  });

  it("parts quita el prefijo OT- del n_ot", async () => {
    mockFetchResponse([{ id: 1, producto_id: "P001" }]);
    await workOrdersApi.parts("OT-123");
    const [url] = g.fetch.mock.calls[0];
    expect(url).toContain("/work-orders/123/parts");
    expect(url).not.toContain("OT-");
  });

  it("parts funciona con n_ot sin prefijo", async () => {
    mockFetchResponse([{ id: 1 }]);
    await workOrdersApi.parts("456");
    const [url] = g.fetch.mock.calls[0];
    expect(url).toContain("/work-orders/456/parts");
  });
});

// ── partsApi ──────────────────────────────────────────────────────────────────

describe("partsApi", () => {
  const fakeList = {
    metadata: { total_records: 50, current_page: 1, page_size: 10, total_pages: 5 },
    data: [{ c_repuesto: "R001" }],
  };

  it("list construye URL con search", async () => {
    mockFetchResponse(fakeList);
    await partsApi.list({ search: "filtro" });
    const [url] = g.fetch.mock.calls[0];
    expect(url).toContain("search=filtro");
  });

  it("list sin parámetros", async () => {
    mockFetchResponse(fakeList);
    const res = await partsApi.list();
    expect(res.metadata.total_records).toBe(50);
  });
});

// ── apiFetch edge cases ───────────────────────────────────────────────────────

describe("apiFetch edge cases", () => {
  it("lanza error con detail del backend si existe", async () => {
    mockFetchResponse({ detail: "bad request" }, 400);
    await expect(authApi.me()).rejects.toThrow("bad request");
  });

  it("lanza error con status code si no hay detail", async () => {
    mockFetchResponse({}, 400);
    await expect(authApi.me()).rejects.toThrow("Error 400");
  });

  it("lanza error con status code si body no es JSON", async () => {
    mockFetchResponse("Internal Server Error", 500, "text/plain");
    await expect(authApi.me()).rejects.toThrow("Error 500");
  });

  it("maneja 204 No Content devolviendo objeto vacío", async () => {
    mockFetchNoContent();
    const res = await authApi.logout();
    expect(res).toEqual({});
  });

  it("incluye credentials: include en todas las requests", async () => {
    mockFetchResponse({});
    await authApi.me();
    const [, opts] = g.fetch.mock.calls[0];
    expect(opts.credentials).toBe("include");
  });
});
