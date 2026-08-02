/**
 * Combine a loop's per-attempt controller with the caller's optional signal so
 * either can cancel the in-flight provider request. Returns the controller's
 * own signal when the caller passed none.
 */
export function combineAbortSignals({
  controller,
  signal,
}: {
  controller: AbortController;
  signal?: AbortSignal;
}): AbortSignal {
  if (!signal) {
    return controller.signal;
  }
  return AbortSignal.any([controller.signal, signal]);
}
