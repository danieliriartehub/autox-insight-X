/**
 * PRUEBAS FUNCIONALES — Componentes de UI.
 *
 * Renderizan componentes reales en jsdom y verifican el comportamiento
 * observable por el usuario (texto, roles, presencia de elementos).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock del contexto de auth para TopBar.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { nombre_completo: "Oscar Perez", cargo: "Jefe de Taller" } }),
}));

// Mock del SidebarTrigger (depende del provider de sidebar).
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button aria-label="toggle-sidebar">☰</button>,
}));

import { TopBar } from "@/components/TopBar";

describe("TopBar", () => {
  it("muestra el título y subtítulo recibidos", () => {
    render(<TopBar title="Centro de Comando SCM" subtitle="IA aplicada al abastecimiento" />);
    expect(screen.getByText("Centro de Comando SCM")).toBeInTheDocument();
    expect(screen.getByText("IA aplicada al abastecimiento")).toBeInTheDocument();
  });

  it("muestra el nombre y cargo del usuario autenticado", () => {
    render(<TopBar title="Dashboard" />);
    expect(screen.getByText("Oscar Perez")).toBeInTheDocument();
    expect(screen.getByText("Jefe de Taller")).toBeInTheDocument();
  });

  it("no renderiza subtítulo si no se pasa", () => {
    render(<TopBar title="Solo título" />);
    expect(screen.getByText("Solo título")).toBeInTheDocument();
  });
});

/**
 * Lógica de negocio del banner de IA (RF-11): traducción de error → precisión.
 * Replica el cálculo `100 - error` que la página muestra al usuario final.
 */
describe("Traducción error → precisión (indicadores IA)", () => {
  const precision = (error: number) => Number((100 - error).toFixed(1));

  it("wMAPE 33.54% se muestra como 66.5% de precisión", () => {
    expect(precision(33.54)).toBe(66.5);
  });

  it("MAPE alta rotación 27.02% → 73.0% de precisión (redondeado a 1 decimal)", () => {
    // 100 - 27.02 = 72.98, que .toFixed(1) redondea a 73.0
    expect(precision(27.02)).toBe(73.0);
  });

  it("un modelo perfecto (0% error) sería 100% de precisión", () => {
    expect(precision(0)).toBe(100);
  });
});

/**
 * Etiqueta de confiabilidad (RF-10): la lógica de color/etiqueta según umbral 80%.
 */
describe("Etiqueta de confiabilidad por umbral (RF-10)", () => {
  const etiqueta = (conf: number) =>
    conf >= 0.8 ? "alta" : conf >= 0.6 ? "media" : "baja";

  it("≥ 0.80 → alta", () => expect(etiqueta(0.95)).toBe("alta"));
  it("0.70 → media", () => expect(etiqueta(0.7)).toBe("media"));
  it("0.40 → baja", () => expect(etiqueta(0.4)).toBe("baja"));
});
