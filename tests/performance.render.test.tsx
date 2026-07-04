// ── Pruebas de rendimiento (RNF-03) ───────────────────────────────────────────
// Verifica que la UI cargue y procese datos en menos de 1.5s.
// Mide renderizado de componentes y transformaciones de datos
// que corren en el navegador (agrupaciones, ordenamientos).

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Mocks para aislar el componente TopBar en las pruebas de rendimiento
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { nombre_completo: "Test", cargo: "Admin" } }),
}));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button>☰</button>,
}));

import { TopBar } from "@/components/TopBar";

const UMBRAL_RENDER_MS = 100; // muy holgado; render de un componente simple
const UMBRAL_DATOS_MS = 200; // procesamiento de datos en cliente

describe("Rendimiento de renderizado (RNF-03)", () => {
  it("renderiza TopBar en menos de 100 ms", () => {
    const t0 = performance.now();
    render(<TopBar title="Dashboard" subtitle="test" />);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(UMBRAL_RENDER_MS);
  });

  it("50 renders consecutivos no degradan (media < 50 ms)", () => {
    const tiempos: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      const { unmount } = render(<TopBar title={`T${i}`} />);
      tiempos.push(performance.now() - t0);
      unmount();
    }
    const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    expect(media).toBeLessThan(50);
  });
});

// ── Pruebas de transformación de datos en cliente ────────────────────────────

describe("Rendimiento de procesamiento de datos en cliente", () => {
  it("agrupa y ordena 5000 registros de inventario en < 200 ms", () => {
    // Simula el volumen real de la tabla stock (~5000 SKUs)
    const datos = Array.from({ length: 5000 }, (_, i) => ({
      codigo: `SKU-${i}`,
      stock: Math.floor(Math.random() * 100),
      categoria: ["Frenos", "Aceites", "Filtros", "Otros"][i % 4],
    }));

    const t0 = performance.now();
    // Operaciones que la UI hace: categorías únicas + orden por stock.
    const categorias = Array.from(new Set(datos.map((d) => d.categoria)));
    const ordenado = [...datos].sort((a, b) => a.stock - b.stock);
    const porCategoria = datos.reduce<Record<string, number>>((acc, d) => {
      acc[d.categoria] = (acc[d.categoria] ?? 0) + d.stock;
      return acc;
    }, {});
    const elapsed = performance.now() - t0;

    expect(categorias.length).toBe(4);
    expect(ordenado[0].stock).toBeLessThanOrEqual(ordenado[ordenado.length - 1].stock);
    expect(Object.keys(porCategoria)).toHaveLength(4);
    expect(elapsed).toBeLessThan(UMBRAL_DATOS_MS);
  });

  it("calcula el chart Top-10 (filtro+sort+slice) sobre 600 SKUs en < 50 ms", () => {
    const datos = Array.from({ length: 600 }, (_, i) => ({
      codigo: `R${i}`,
      demanda: Math.random() * 100,
      stock: Math.random() * 100,
    }));
    const t0 = performance.now();
    const top10 = [...datos]
      .map((d) => ({ ...d, deficit: Math.max(0, d.demanda - d.stock) }))
      .sort((a, b) => b.demanda - a.demanda)
      .slice(0, 10);
    const elapsed = performance.now() - t0;
    expect(top10).toHaveLength(10);
    expect(elapsed).toBeLessThan(50);
  });
});
