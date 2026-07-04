// ── Pruebas del capturador de errores global (error-capture.ts) ──────────────
// Verifica que los eventos error/unhandledrejection se capturen,
// que el TTL funcione y que cleanup limpie los listeners.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Importamos dinámicamente para resetear el módulo entre tests
const MODULE_PATH = "@/lib/error-capture";

async function loadModule() {
  return await import(MODULE_PATH);
}

describe("error-capture", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("consumeLastCapturedError devuelve undefined si no hubo error", async () => {
    const mod = await loadModule();
    expect(mod.consumeLastCapturedError()).toBeUndefined();
  });

  it("captura un error global y lo devuelve con consumeLastCapturedError", async () => {
    const mod = await loadModule();
    const testError = new Error("algo explotó");
    window.dispatchEvent(new ErrorEvent("error", { error: testError }));
    expect(mod.consumeLastCapturedError()).toBe(testError);
  });

  it("consumeLastCapturedError limpia el error después de consumirlo", async () => {
    const mod = await loadModule();
    const testError = new Error("otro error");
    window.dispatchEvent(new ErrorEvent("error", { error: testError }));
    mod.consumeLastCapturedError();
    expect(mod.consumeLastCapturedError()).toBeUndefined();
  });

  it("captura unhandledrejection", async () => {
    const mod = await loadModule();
    const reason = new Error("promise rejected");
    const promise = Promise.reject(reason);
    promise.catch(() => {}); // silencia la advertencia de consola
    window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", { promise, reason }));
    expect(mod.consumeLastCapturedError()).toBe(reason);
  });

  it("no devuelve error si el TTL expiró", async () => {
    vi.useFakeTimers();
    const mod = await loadModule();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("viejo") }));
    vi.advanceTimersByTime(6000);
    expect(mod.consumeLastCapturedError()).toBeUndefined();
    vi.useRealTimers();
  });

  it("cleanupGlobalErrorCapture detiene los listeners", async () => {
    const mod = await loadModule();
    mod.cleanupGlobalErrorCapture();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("post-cleanup") }));
    expect(mod.consumeLastCapturedError()).toBeUndefined();
  });

  it("múltiples errores: solo retiene el último", async () => {
    const mod = await loadModule();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("first") }));
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("second") }));
    const captured = mod.consumeLastCapturedError() as Error;
    expect(captured.message).toBe("second");
  });
});
