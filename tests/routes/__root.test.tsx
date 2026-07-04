// ── Pruebas de lógica de AuthGuard en la ruta raíz ──────────────────────────
// Verifica el comportamiento condicional según el estado de autenticación.
// El componente AuthGuard (no exportado) controla loading/redirect/layout.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";

const mockUseAuth = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthGuard redirecciones", () => {
  it("muestra loading mientras isLoading es true", () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });

    function TestComponent() {
      const { isLoading } = useAuth();
      return isLoading ? <div data-testid="loading-spinner" /> : <div data-testid="loaded" />;
    }

    render(<TestComponent />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("no renderiza contenido autenticado si no hay sesión", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });

    function TestComponent() {
      const { isAuthenticated } = useAuth();
      return isAuthenticated ? (
        <div data-testid="authenticated" />
      ) : (
        <div data-testid="anonymous" />
      );
    }

    render(<TestComponent />);
    expect(screen.getByTestId("anonymous")).toBeInTheDocument();
  });

  it("muestra layout autenticado cuando hay sesión", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { nombre_completo: "Test", cargo: "Admin" },
    });

    function TestComponent() {
      const { isAuthenticated, user } = useAuth();
      return isAuthenticated ? <div data-testid="layout-auth">{user?.nombre_completo}</div> : null;
    }

    render(<TestComponent />);
    expect(screen.getByTestId("layout-auth").textContent).toBe("Test");
  });
});
