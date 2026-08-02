//
// Backoff sleep that a caller abort can cut short.
//
// Rate-limit waits are measured in tens of seconds, so a plain sleep would
// hold an aborted request open long after the caller stopped caring. This
// resolves rather than throws on abort: every retry loop re-checks
// `signal.aborted` at the top and raises the abort error there, so a single
// code path owns that decision.
//

export async function abortableSleep({
  ms,
  signal,
}: {
  ms: number;
  signal?: AbortSignal;
}): Promise<void> {
  if (ms <= 0 || signal?.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
  });
}
