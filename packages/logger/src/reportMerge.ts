import { isPlainObject } from "./limits";

/**
 * Merge incoming report data into existing report data. Plain objects merge
 * recursively; arrays and scalars are leaves where the incoming value wins.
 * Returns the merged object and the dotted paths of leaves whose value
 * changed. Neither input is mutated.
 */
export function reportMerge({
  existing,
  incoming,
  path = "",
}: {
  existing: Record<string, unknown>;
  incoming: Record<string, unknown>;
  path?: string;
}): { merged: Record<string, unknown>; overwrites: string[] } {
  const merged: Record<string, unknown> = { ...existing };
  const overwrites: string[] = [];
  for (const key of Object.keys(incoming)) {
    const keyPath = path ? `${path}.${key}` : key;
    const current = merged[key];
    const next = incoming[key];
    if (isPlainObject(current) && isPlainObject(next)) {
      const nested = reportMerge({
        existing: current,
        incoming: next,
        path: keyPath,
      });
      merged[key] = nested.merged;
      overwrites.push(...nested.overwrites);
      continue;
    }
    if (key in merged && current !== next) {
      overwrites.push(keyPath);
    }
    merged[key] = next;
  }
  return { merged, overwrites };
}
