// ── Pruebas de AuthContext y useAuth ──────────────────────────────────────────
// Verifica el flujo de autenticación: login, logout, rehidratación,
// manejo de errores y comportamiento del Provider.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const mockLogin = vi.fn();
const mockMe = vi.fn();
const mockLogout = vi.fn();

vi.mock("@/lib/api", () => ({
  authApi: {
    login: (...args: unknown[]) => mockLogin(...args),
    me: (...args: unknown[]) => mockMe(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
  },
}));

const dummyUser = {
  correo_corporativo: "test@bpamotors.com",
  nombre_completo: "Juan Perez",
  cargo: "Jefe de Taller",
};

function renderAuth(logHandler?: () => Promise<void>) {
  let authState: ReturnType<typeof useAuth> | null = null;
  function Consumer() {
    authState = useAuth();
    return (
      <div>
        <span data-testid="auth-status">
          {authState.isLoading
            ? "loading"
            : authState.isAuthenticated
              ? "authenticated"
              : "anonymous"}
        </span>
        {authState.user && <span data-testid="user-name">{authState.user.nombre_completo}</span>}
        {authState.loginError && <span data-testid="login-error">{authState.loginError}</span>}
        <button
          data-testid="login-btn"
          onClick={() => {
            if (logHandler) {
              logHandler();
            } else {
              void authState!.login("a@b.com", "pass").catch(() => {});
            }
          }}
        >
          Login
        </button>
        <button data-testid="logout-btn" onClick={() => void authState!.logout().catch(() => {})}>
          Logout
        </button>
      </div>
    );
  }
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
  return () => authState;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMe.mockResolvedValue(dummyUser);
});

describe("AuthProvider", () => {
  it("inicia en loading y luego se autentica si /me responde OK", async () => {
    renderAuth();
    expect(screen.getByTestId("auth-status").textContent).toBe("loading");
    await waitFor(() => {
      expect(screen.getByTestId("auth-status").textContent).toBe("authenticated");
    });
    expect(screen.getByTestId("user-name").textContent).toBe("Juan Perez");
  });

  it("queda como anonymous si /me responde error", async () => {
    mockMe.mockRejectedValue(new Error("401"));
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId("auth-status").textContent).toBe("anonymous");
    });
  });

  it("hace login exitoso y actualiza el estado", async () => {
    mockMe.mockRejectedValue(new Error("401"));
    mockLogin.mockResolvedValue({ user: dummyUser });
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId("auth-status").textContent).toBe("anonymous");
    });
    fireEvent.click(screen.getByTestId("login-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("auth-status").textContent).toBe("authenticated");
    });
    expect(mockLogin).toHaveBeenCalledWith("a@b.com", "pass");
  });

  it("fallo de login muestra error y mantiene anonymous", async () => {
    mockMe.mockRejectedValue(new Error("401"));
    mockLogin.mockRejectedValue(new Error("Credenciales incorrectas"));
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId("auth-status").textContent).toBe("anonymous");
    });
    fireEvent.click(screen.getByTestId("login-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("login-error").textContent).toBe("Credenciales incorrectas");
    });
  });

  it("logout limpia el usuario incluso si falla el request", async () => {
    mockLogout.mockRejectedValue(new Error("network error"));
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId("auth-status").textContent).toBe("authenticated");
    });
    fireEvent.click(screen.getByTestId("logout-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("auth-status").textContent).toBe("anonymous");
    });
  });

  it("useAuth fuera de AuthProvider lanza error", () => {
    const Oops = () => {
      useAuth();
      return null;
    };
    expect(() => render(<Oops />)).toThrow("useAuth debe usarse dentro de <AuthProvider>");
  });
});
