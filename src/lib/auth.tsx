import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "taller" | "almacen";

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rol: Role;
  rolLabel: string;
}

// Demo users for mock auth (password: demo123 for all)
export const DEMO_USERS: (AuthUser & { password: string })[] = [
  { id: "u1", nombre: "Carlos Mendoza", email: "admin@bpamotors.com", password: "demo123", rol: "admin", rolLabel: "Administrador" },
  { id: "u2", nombre: "Luis Ramírez", email: "taller@bpamotors.com", password: "demo123", rol: "taller", rolLabel: "Jefe de Taller" },
  { id: "u3", nombre: "Ana Torres", email: "almacen@bpamotors.com", password: "demo123", rol: "almacen", rolLabel: "Jefe de Almacén" },
];

// Module access matrix: which routes each role can see
export const ROLE_ACCESS: Record<Role, string[]> = {
  admin: ["/", "/taller", "/almacen", "/catalogo", "/analytics", "/prediccion", "/admin"],
  taller: ["/", "/taller", "/catalogo", "/analytics", "/prediccion"],
  almacen: ["/", "/almacen", "/catalogo", "/analytics", "/prediccion"],
};

export function canAccess(rol: Role | undefined, path: string): boolean {
  if (!rol) return false;
  const allowed = ROLE_ACCESS[rol];
  if (allowed.includes(path)) return true;
  // allow nested paths
  return allowed.some((p) => p !== "/" && path.startsWith(p + "/"));
}

interface AuthCtx {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "bpa.auth.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const login: AuthCtx["login"] = (email, password) => {
    const match = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    );
    if (!match) return { ok: false, error: "Credenciales inválidas" };
    const { password: _pw, ...safe } = match;
    setUser(safe);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); } catch {}
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
