const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Combine two tally values. Numbers sum, strings collect into an array of
 * strings, booleans AND, arrays concatenate, and plain objects merge
 * recursively. Null and undefined defer to the other value. Mismatched
 * types preserve both values in an array.
 */
export function tallyMerge({
  existing,
  incoming,
}: {
  existing: unknown;
  incoming: unknown;
}): unknown {
  if (existing === undefined || existing === null) return incoming;
  if (incoming === undefined || incoming === null) return existing;
  if (typeof existing === "number" && typeof incoming === "number") {
    return existing + incoming;
  }
  if (typeof existing === "boolean" && typeof incoming === "boolean") {
    return existing && incoming;
  }
  if (typeof existing === "string" && typeof incoming === "string") {
    return [existing, incoming];
  }
  if (Array.isArray(existing)) {
    return Array.isArray(incoming)
      ? [...existing, ...incoming]
      : [...existing, incoming];
  }
  if (Array.isArray(incoming)) {
    return [existing, ...incoming];
  }
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    const merged: Record<string, unknown> = { ...existing };
    for (const key of Object.keys(incoming)) {
      merged[key] =
        key in merged
          ? tallyMerge({ existing: merged[key], incoming: incoming[key] })
          : incoming[key];
    }
    return merged;
  }
  return [existing, incoming];
}
