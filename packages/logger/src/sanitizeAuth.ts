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

export function sanitizeAuth(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const obj = value as Record<string, unknown>;
  let clone: Record<string, unknown> | undefined;

  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase();

    if (lower === "authorization") {
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
        for (const hKey of Object.keys(hdrs)) {
          if (hKey.toLowerCase() === "authorization") {
            if (!clone) clone = { ...obj };
            const clonedHeaders = { ...hdrs };
            clonedHeaders[hKey] = redactAuth(hdrs[hKey]);
            clone[key] = clonedHeaders;
            break;
          }
        }
      }
    }
  }

  return clone ?? value;
}
