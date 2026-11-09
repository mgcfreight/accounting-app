// Errors from a page chunk that failed to download. main.tsx marks each one
// as Vite reports it (vite:preloadError hands over the same object it then
// throws), so the error boundary can tell them apart without matching
// browser-specific messages.
const chunkErrors = new WeakSet<object>();

export function markChunkLoadError(error: unknown) {
  if (typeof error === "object" && error !== null) chunkErrors.add(error);
}

export function isChunkLoadError(error: unknown) {
  return typeof error === "object" && error !== null && chunkErrors.has(error);
}
