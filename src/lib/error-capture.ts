// ── Captura de errores global ─────────────────────────────────────────────────
// Atrapa el Error original antes de que h3 lo envuelva en un 500 genérico,
// para que server.ts pueda recuperar el stack trace real.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

const globalAbortController = new AbortController();
const globalSignal = globalAbortController.signal;

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event), {
    signal: globalSignal,
  });
  globalThis.addEventListener(
    "unhandledrejection",
    (event) => record((event as PromiseRejectionEvent).reason),
    { signal: globalSignal },
  );
}

export function cleanupGlobalErrorCapture() {
  globalAbortController.abort();
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
