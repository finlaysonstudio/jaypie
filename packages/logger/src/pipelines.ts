interface Pipeline {
  key: string;
  filter: (value: unknown) => unknown;
}

//
// Key-based pipelines (match on var key name)
//

function isAxiosResponse(response: unknown): boolean {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  const r = response as Record<string, unknown>;
  return !!(
    r &&
    r.config &&
    r.data &&
    r.headers &&
    r.request &&
    r.status &&
    r.statusText
  );
}

function filterAxiosResponse(response: unknown): unknown {
  if (!isAxiosResponse(response)) {
    return response;
  }
  const r = response as Record<string, unknown>;
  const newResponse: Record<string, unknown> = {
    data: r.data,
    headers: r.headers,
    status: r.status,
    statusText: r.statusText,
  };
  if (r.isAxiosError) {
    newResponse.isAxiosError = r.isAxiosError;
  }
  return newResponse;
}

export const axiosResponseVarPipeline: Pipeline = {
  filter: filterAxiosResponse,
  key: "response",
};

export const pipelines = [axiosResponseVarPipeline];

//
// Type-based filters (run on any key, match on value shape)
//

interface TypeFilter {
  detect: (value: unknown) => boolean;
  filter: (value: unknown) => unknown;
}

// Fetch Response

function isFetchResponse(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return !!(
    typeof r.ok === "boolean" &&
    typeof r.status === "number" &&
    typeof r.statusText === "string" &&
    "headers" in r &&
    "body" in r &&
    typeof r.url === "string" &&
    !("config" in r) &&
    !("request" in r)
  );
}

function headersToObject(headers: unknown): Record<string, string> | unknown {
  if (
    headers &&
    typeof headers === "object" &&
    typeof (headers as Record<string, unknown>).entries === "function"
  ) {
    const result: Record<string, string> = {};
    for (const [key, value] of (headers as Headers).entries()) {
      result[key] = value;
    }
    return result;
  }
  return headers;
}

function filterFetchResponse(value: unknown): unknown {
  const r = value as Record<string, unknown>;
  return {
    headers: headersToObject(r.headers),
    ok: r.ok,
    redirected: r.redirected,
    status: r.status,
    statusText: r.statusText,
    type: r.type,
    url: r.url,
  };
}

// Error

function isError(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (value instanceof Error) {
    return true;
  }
  const i = value as Record<string, unknown>;
  if (i.isProjectError) {
    return true;
  }
  return false;
}

function filterError(value: unknown): unknown {
  const e = value as Error & Record<string, unknown>;
  const newItem: Record<string, unknown> = {
    message: e.message,
    name: e.name,
  };
  if (e.cause) {
    newItem.cause = e.cause;
  }
  if (e.stack) {
    newItem.stack = e.stack;
  }
  if (e.isProjectError) {
    newItem.isProjectError = e.isProjectError;
    newItem.title = e.title;
    newItem.detail = e.detail;
    newItem.status = e.status;
  }
  return newItem;
}

// Type filter registry (order matters — first match wins)

const typeFilters: TypeFilter[] = [
  { detect: isFetchResponse, filter: filterFetchResponse },
  { detect: isError, filter: filterError },
];

//
// Opaque object detection and generic extraction
//

function isOpaqueObject(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  // Plain objects are fine
  if (
    value.constructor === Object ||
    value.constructor === undefined
  ) {
    return false;
  }
  // If JSON.stringify produces "{}" the object has no own enumerable properties
  // and will log as useless "[object Type]"
  try {
    const json = JSON.stringify(value);
    return json === "{}" || json === "[]";
  } catch {
    return true;
  }
}

function extractOpaqueObject(value: unknown): Record<string, unknown> {
  const obj = value as object;
  const result: Record<string, unknown> = {};

  const ctorName = obj.constructor?.name;
  if (ctorName && ctorName !== "Object") {
    result._type = ctorName;
  }

  // If the object itself is map-like (Headers, URLSearchParams, FormData, etc.),
  // convert its entries directly
  const mapLike = obj as Record<string, unknown>;
  if (
    typeof mapLike.entries === "function" &&
    typeof mapLike.forEach === "function"
  ) {
    try {
      const entries = Object.fromEntries(
        (mapLike as { entries: () => Iterable<[string, unknown]> }).entries(),
      );
      return { ...result, ...entries };
    } catch {
      // Fall through to generic extraction
    }
  }

  // Collect readable non-function properties from the prototype chain
  let proto: object | null = obj;
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === "constructor" || key in result) {
        continue;
      }
      try {
        const desc = Object.getOwnPropertyDescriptor(proto, key);
        if (!desc) continue;
        // Read getters and value properties from the original object
        const val = (obj as Record<string, unknown>)[key];
        if (typeof val === "function" || typeof val === "symbol") {
          continue;
        }
        // Skip streams and other non-serializable objects
        if (
          val &&
          typeof val === "object" &&
          typeof (val as Record<string, unknown>).pipe === "function"
        ) {
          continue;
        }
        // Convert iterable map-like objects (Headers, URLSearchParams, etc.)
        if (
          val &&
          typeof val === "object" &&
          typeof (val as Record<string, unknown>).entries === "function" &&
          typeof (val as Record<string, unknown>).forEach === "function"
        ) {
          result[key] = Object.fromEntries(
            (val as { entries: () => Iterable<[string, unknown]> }).entries(),
          );
          continue;
        }
        result[key] = val;
      } catch {
        // Property threw on access — skip
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  return result;
}

//
// Public API
//

/**
 * Filter a value by type, regardless of var key name.
 * Tries known type filters first, then falls back to generic
 * opaque object extraction for anything that would log as [object Type].
 */
export function filterByType(value: unknown): unknown {
  // Try known type filters
  for (const tf of typeFilters) {
    if (tf.detect(value)) {
      return tf.filter(value);
    }
  }
  // Generic fallback for opaque objects
  if (isOpaqueObject(value)) {
    return extractOpaqueObject(value);
  }
  return value;
}

// Legacy exports for key-based pipeline (axios only now)
export const errorVarPipeline: Pipeline = {
  filter: (item: unknown) => {
    if (!isError(item)) return item;
    return filterError(item);
  },
  key: "error",
};
