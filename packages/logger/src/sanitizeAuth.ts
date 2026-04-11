import { createHash } from "node:crypto";

//
//
// Helper
//

export function redactAuth(value: unknown): string {
  const str = String(value);
  if (/sk\S+/.test(str)) {
    return `sk_${str.slice(-4)}`;
  }
  const hash = createHash("md5").update(str).digest("hex");
  return `md5_${hash.slice(-4)}`;
}

//
//
// Main
//

const REDACTED_KEYS = new Set([
  "authorization",
  "x-service-key",
  "x-webhook-token",
]);

export function sanitizeAuth(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const obj = value as Record<string, unknown>;
  let clone: Record<string, unknown> | undefined;

  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase();

    if (REDACTED_KEYS.has(lower)) {
      if (!clone) clone = { ...obj };
      clone[key] = redactAuth(obj[key]);
    } else if (lower === "headers") {
      const headers = obj[key];
      if (
        typeof headers === "object" &&
        headers !== null &&
        !Array.isArray(headers)
      ) {
        const hdrs = headers as Record<string, unknown>;
        let clonedHeaders: Record<string, unknown> | undefined;
        for (const hKey of Object.keys(hdrs)) {
          if (REDACTED_KEYS.has(hKey.toLowerCase())) {
            if (!clonedHeaders) clonedHeaders = { ...hdrs };
            clonedHeaders[hKey] = redactAuth(hdrs[hKey]);
          }
        }
        if (clonedHeaders) {
          if (!clone) clone = { ...obj };
          clone[key] = clonedHeaders;
        }
      }
    }
  }

  return clone ?? value;
}
