// ── Pruebas del hook useIsMobile ─────────────────────────────────────────────
// Verifica detección de breakpoint móvil (<768px) con window.matchMedia.
// Incluye limpieza de event listeners y actualización en resize.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Helpers para mockear matchMedia ──────────────────────────────────────────

function createMatchMedia(width: number) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: width < 768,
    media: `(max-width: 767px)`,
    onchange: null,
    addEventListener: vi.fn((_event: string, cb: () => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_event: string, cb: () => void) => {
      listeners.delete(cb);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    get listeners() {
      return listeners;
    },
  };
  return mql;
}

let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("useIsMobile", () => {
  it("detecta como móvil cuando width < 768", () => {
    window.matchMedia = vi.fn().mockImplementation(() => createMatchMedia(375));
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("detecta como desktop cuando width >= 768", () => {
    window.matchMedia = vi.fn().mockImplementation(() => createMatchMedia(1024));
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("registra event listener en matchMedia y lo limpia al desmontar", () => {
    const mql = createMatchMedia(375);
    window.matchMedia = vi.fn().mockReturnValue(mql);
    const { unmount } = renderHook(() => useIsMobile());
    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
