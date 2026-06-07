/**
 * AuthContext — Gestión global del estado de autenticación.
 *
 * Principios de seguridad aplicados:
 * - El JWT vive SOLO en la cookie HttpOnly del navegador.
 *   El frontend nunca lo lee, almacena ni manipula.
 * - El estado del usuario (`user`) se guarda en memoria React (Context),
 *   que se limpia al cerrar la pestaña. Para persistir entre refreshes
 *   se consulta GET /me al montar el provider.
 * - localStorage / sessionStorage: NO se usan para nada sensible.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, type UserPublic } from "@/lib/api";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserPublic | null;
  isAuthenticated: boolean;
  /** true mientras se verifica la sesión inicial (GET /me) */
  isLoading: boolean;
  /** Mensaje de error del último intento de login */
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true); // arranca en true para verificar sesión
  const [loginError, setLoginError] = useState<string | null>(null);

  // Al montar: intenta rehidratar la sesión desde la cookie existente.
  // Si la cookie está expirada o no existe, /me devolverá 401 → isLoading=false, user=null.
  useEffect(() => {
    authApi
      .me()
      .then((profile) => setUser(profile))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoginError(null);
    try {
      const { user: profile } = await authApi.login(email, password);
      setUser(profile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión.";
      setLoginError(msg);
      throw err; // re-lanzamos para que la página lo maneje si es necesario
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Limpiamos el estado aunque el request falle (seguridad por defecto)
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        loginError,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
