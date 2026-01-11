/**
 * Normalizes an array of weights to sum to 1.0
 *
 * @param weights - Array of weight values (any positive numbers)
 * @returns Array of normalized weights summing to 1.0
 *
 * @example
 * normalizeWeights([1, 2, 3, 4]); // [0.1, 0.2, 0.3, 0.4]
 * normalizeWeights([5, 5]);       // [0.5, 0.5]
 */
export function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) {
    return weights;
  }
  return weights.map((w) => w / total);
}
