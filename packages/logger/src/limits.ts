import { DEFAULT, LIMIT_ENV } from "./constants";

//
//
// Types
//

/**
 * Caller-facing limit options. `false` explicitly disables a limit;
 * `undefined` resolves from env vars, then defaults.
 */
export interface SerializationLimitOptions {
  maxDepth?: number | false;
  maxEntryBytes?: number | false;
  maxStringLength?: number | false;
}

/**
 * Resolved limits. `undefined` means the limit is off.
 */
export interface SerializationLimits {
  maxDepth?: number;
  maxEntryBytes?: number;
  maxStringLength?: number;
}

//
//
// Constants
//

const CIRCULAR_PLACEHOLDER = "[Circular]";
const DISABLED_ENV_VALUES = ["", "0", "false", "none", "off"];
const ELLIPSIS = "…";
// Reserve headroom for the truncation marker when fitting a string to a
// byte budget
const MARKER_RESERVE_BYTES = 64;

/** Characters preserved when an oversized entry truncates an attribute */
export const ENTRY_PREVIEW_LENGTH = 72;

//
//
// Helpers
//

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeLimit(option: number | false): number | undefined {
  if (option === false) return undefined;
  if (typeof option === "number" && Number.isFinite(option) && option > 0) {
    return Math.floor(option);
  }
  return undefined;
}

function resolveLimit(
  option: number | false | undefined,
  envKey: string,
  defaultValue?: number,
): number | undefined {
  if (option !== undefined) {
    return normalizeLimit(option);
  }
  const raw = process.env[envKey];
  if (raw !== undefined) {
    if (DISABLED_ENV_VALUES.includes(raw.toLowerCase())) return undefined;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return defaultValue;
}

function truncationMarker(droppedChars: number): string {
  return `${ELLIPSIS} [truncated ${droppedChars.toLocaleString("en-US")} chars]`;
}

//
//
// Main
//

/**
 * Resolve limits from explicit options, env vars, then defaults.
 * `maxEntryBytes` defaults on (payloads must fit the log pipeline);
 * `maxDepth` and `maxStringLength` default off.
 */
export function resolveSerializationLimits(
  options: SerializationLimitOptions = {},
): SerializationLimits {
  return {
    maxDepth: resolveLimit(options.maxDepth, LIMIT_ENV.MAX_DEPTH),
    maxEntryBytes: resolveLimit(
      options.maxEntryBytes,
      LIMIT_ENV.MAX_ENTRY_BYTES,
      DEFAULT.MAX_ENTRY_BYTES,
    ),
    maxStringLength: resolveLimit(
      options.maxStringLength,
      LIMIT_ENV.MAX_STRING,
    ),
  };
}

export function hasValueLimits(limits: SerializationLimits): boolean {
  return limits.maxDepth !== undefined || limits.maxStringLength !== undefined;
}

export function byteLength(value: unknown): number {
  try {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    return Buffer.byteLength(str ?? "", "utf8");
  } catch {
    return 0;
  }
}

/**
 * Keep the first `maxLength` characters and append a visible marker
 * preserving the dropped size
 */
export function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength) + truncationMarker(value.length - maxLength);
}

/**
 * Fit a string to a byte budget, reserving room for the marker and
 * never cutting below the preview length
 */
export function truncateToBudget(value: string, budgetBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= budgetBytes) return value;
  const maxLength = Math.max(
    ENTRY_PREVIEW_LENGTH,
    budgetBytes - MARKER_RESERVE_BYTES,
  );
  return truncateString(value, maxLength);
}

/**
 * Walk a value applying maxStringLength and maxDepth. Returns a new value;
 * never mutates the input. Only plain objects and arrays are traversed so
 * class instances (Error, Date, ...) keep their serialization behavior.
 */
export function applyValueLimits(
  value: unknown,
  limits: SerializationLimits,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  const { maxDepth, maxStringLength } = limits;
  if (typeof value === "string") {
    return maxStringLength !== undefined
      ? truncateString(value, maxStringLength)
      : value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
    if (maxDepth !== undefined && depth > maxDepth) {
      return `[Array(${value.length})]`;
    }
    seen.add(value);
    const result = value.map((item) =>
      applyValueLimits(item, limits, depth + 1, seen),
    );
    seen.delete(value);
    return result;
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
    if (maxDepth !== undefined && depth > maxDepth) {
      return "[Object]";
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      result[key] = applyValueLimits(value[key], limits, depth + 1, seen);
    }
    seen.delete(value);
    return result;
  }
  return value;
}

function truncateToPreview(value: unknown): unknown {
  const str =
    typeof value === "string"
      ? value
      : (JSON.stringify(value) ?? String(value));
  if (str.length <= ENTRY_PREVIEW_LENGTH) return value;
  return truncateString(str, ENTRY_PREVIEW_LENGTH);
}

/**
 * Fit a serialized log entry under maxEntryBytes. Truncates the top-level
 * attributes of `data` largest-first to short previews until the entry fits,
 * collapsing `data` to a byte-count marker only as a last resort. When
 * `syncMessageToData` is set (var entries and single-object messages, where
 * `message` mirrors `data`), the message is rebuilt from the truncated data.
 * Returns a new entry; never mutates the input.
 */
export function enforceEntryLimit(
  entry: Record<string, unknown>,
  {
    maxEntryBytes,
    syncMessageToData = false,
  }: { maxEntryBytes: number; syncMessageToData?: boolean },
): Record<string, unknown> {
  const originalBytes = byteLength(entry);
  if (originalBytes <= maxEntryBytes) return entry;

  const result = { ...entry };
  const sync = () => {
    if (syncMessageToData) {
      result.message =
        typeof result.data === "string"
          ? result.data
          : (JSON.stringify(result.data) ?? String(result.data));
    }
  };

  const data = result.data;
  if (typeof data === "string") {
    result.data = truncateToPreview(data);
    sync();
  } else if (Array.isArray(data) || isPlainObject(data)) {
    const container: Record<string, unknown> = Array.isArray(data)
      ? ([...data] as unknown as Record<string, unknown>)
      : { ...data };
    result.data = container;
    const keys = Object.keys(container).sort(
      (a, b) => byteLength(container[b]) - byteLength(container[a]),
    );
    for (const key of keys) {
      container[key] = truncateToPreview(container[key]);
      sync();
      if (byteLength(result) <= maxEntryBytes) return result;
    }
  } else if (typeof result.message === "string") {
    // No structured data: the message itself is oversized
    const overhead = originalBytes - byteLength(result.message);
    result.message = truncateToBudget(
      result.message,
      Math.max(ENTRY_PREVIEW_LENGTH, maxEntryBytes - overhead),
    );
  }

  if (byteLength(result) <= maxEntryBytes) return result;

  // Last resort: entry is still oversized after attribute-level truncation
  const marker = `[truncated ${originalBytes.toLocaleString("en-US")} bytes]`;
  if ("data" in result) {
    result.data = marker;
    if (syncMessageToData) result.message = marker;
  } else if (typeof result.message === "string") {
    result.message = marker;
  }
  return result;
}
