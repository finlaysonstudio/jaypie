import { createHash } from "node:crypto";

import { ConfigurationError } from "@jaypie/errors";

const HASH_ALGORITHM = "sha1";
const UUID_BYTES = 16;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VARIANT_BYTE = 8;
const VARIANT_MASK = 0x3f;
const VARIANT_RFC4122 = 0x80;
const VERSION_BYTE = 6;
const VERSION_MASK = 0x0f;
const VERSION_V5 = 0x50;

/**
 * Generate an RFC 4122 version 5 (name-based, SHA-1) UUID.
 *
 * Implemented on `node:crypto` so the CommonJS build does not require the
 * ESM-only `uuid` package.
 */
export function uuidv5(
  name: string,
  { namespace }: { namespace: string },
): string {
  if (!UUID_PATTERN.test(namespace)) {
    throw new ConfigurationError(
      `uuidv5 namespace must be a uuid (received "${namespace}")`,
    );
  }

  const bytes = createHash(HASH_ALGORITHM)
    .update(Buffer.from(namespace.replace(/-/g, ""), "hex"))
    .update(name, "utf8")
    .digest()
    .subarray(0, UUID_BYTES);

  bytes[VERSION_BYTE] = (bytes[VERSION_BYTE] & VERSION_MASK) | VERSION_V5;
  bytes[VARIANT_BYTE] = (bytes[VARIANT_BYTE] & VARIANT_MASK) | VARIANT_RFC4122;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
