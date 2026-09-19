//
//
// Main
//

/**
 * Clamp negatives to zero and rescale so the values sum to one. A
 * distribution that sums to zero (every value zero or negative) becomes
 * uniform: the model expressed no preference, and a uniform distribution says
 * exactly that.
 */
export function normalizeDistribution(
  distribution: Record<string, number>,
): Record<string, number> {
  const keys = Object.keys(distribution);
  if (keys.length === 0) {
    return {};
  }
  const clamped: Record<string, number> = {};
  let sum = 0;
  for (const key of keys) {
    const value = distribution[key];
    const safe = Number.isFinite(value) && value > 0 ? value : 0;
    clamped[key] = safe;
    sum += safe;
  }
  if (sum === 0) {
    const uniform = 1 / keys.length;
    return Object.fromEntries(keys.map((key) => [key, uniform]));
  }
  return Object.fromEntries(keys.map((key) => [key, clamped[key] / sum]));
}

/**
 * Confidence as normalized peak probability:
 * `(max(p) - 1/n) / (1 - 1/n)`, where `n` is the number of options.
 *
 * Zero when the distribution is uniform (no information), one when all mass
 * sits on a single option. TypeSafe describes `confidence` as "a statistic
 * computed from the probability distribution" without publishing the formula;
 * this definition reproduces both documented examples within rounding
 * (0.6/0.38/0.02 reports 0.39, 0.7/0.3/0.0 reports 0.54) and a live Jev call
 * (0.0/0.3/0.7 reported 0.56). It is a Jaypie definition until TypeSafe
 * publishes theirs, and applies only to emulated answers: a native answer
 * carries the provider's own number.
 */
export function peakConfidence(distribution: Record<string, number>): number {
  const values = Object.values(distribution);
  const count = values.length;
  if (count <= 1) {
    return count === 1 ? 1 : 0;
  }
  const peak = Math.max(...values);
  const floor = 1 / count;
  const confidence = (peak - floor) / (1 - floor);
  return Math.min(1, Math.max(0, confidence));
}
