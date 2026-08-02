//
// Request pacing for the live matrix.
//
// Mistral enforces a requests-per-second ceiling that varies by tier and by
// model, and it returns a bare 429 with no Retry-After header, so a run that
// outpaces the ceiling fails on rate limiting rather than on capability. The
// matrix cannot solve that by retrying: `operate()` classifies 429 as a
// terminal LlmRateLimitError and does not retry it within the request budget.
//
// Pacing is enforced per model request rather than per cell, because one cell
// is a multi-turn loop that can issue many requests. Adapters call the
// `beforeEachModelRequest` hook once per turn, which is the seam the matrix
// wires this into.
//
// Cells run strictly serially in matrix.ts, so a single spacer is sufficient;
// this deliberately does not implement a concurrent token bucket.
//

const MILLISECONDS_PER_SECOND = 1000;

/**
 * Spaces calls to `acquire()` so they issue no faster than
 * `requestsPerSecond`. A rate of 0 or below disables pacing entirely.
 */
export class RateLimiter {
  private readonly intervalMs: number;
  private queue: Promise<void> = Promise.resolve();
  private last = 0;

  constructor({ requestsPerSecond }: { requestsPerSecond: number }) {
    this.intervalMs =
      requestsPerSecond > 0 ? MILLISECONDS_PER_SECOND / requestsPerSecond : 0;
  }

  /** Milliseconds enforced between requests. */
  get spacingMs(): number {
    return this.intervalMs;
  }

  /**
   * Resolves when the caller may issue its request. Calls are chained, so
   * concurrent callers queue rather than all waiting the same interval.
   */
  async acquire(): Promise<void> {
    if (this.intervalMs <= 0) return;
    const wait = this.queue.then(async () => {
      const elapsed = Date.now() - this.last;
      const remaining = this.intervalMs - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      this.last = Date.now();
    });
    // Swallow rejections on the chain so one failure does not poison the queue.
    this.queue = wait.catch(() => undefined);
    return wait;
  }
}

/**
 * Requests per second to allow for a given model. Falls back to the provider
 * default, then to unlimited.
 *
 * Mistral's published per-model ceilings on the current tier: Large is far
 * more restricted than the smaller models.
 */
const MODEL_REQUESTS_PER_SECOND: Record<string, number> = {
  "mistral-large-2512": 0.07,
  "mistral-large-latest": 0.07,
  "mistral-medium-3-5": 0.83,
  "mistral-medium-latest": 0.83,
  "mistral-ocr-4-0": 0.83,
  "mistral-small-2603": 0.83,
  "mistral-small-latest": 0.83,
};

const PROVIDER_REQUESTS_PER_SECOND: Record<string, number> = {
  mistral: 0.83,
};

/**
 * Resolve the pacing for a model. `APP_RPS` overrides every entry, so a run
 * on a higher tier does not need a code change.
 */
export function requestsPerSecondFor({
  model,
  provider,
}: {
  model: string;
  provider: string;
}): number {
  const override = Number(process.env.APP_RPS);
  if (Number.isFinite(override) && override > 0) return override;
  return (
    MODEL_REQUESTS_PER_SECOND[model] ??
    PROVIDER_REQUESTS_PER_SECOND[provider] ??
    0
  );
}
