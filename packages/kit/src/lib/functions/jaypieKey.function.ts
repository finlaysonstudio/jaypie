import { createHash, createHmac, randomBytes } from "node:crypto";

import { log } from "@jaypie/logger";

//
//
// Constants
//

const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const DEFAULTS = {
  CHECKSUM: 4,
  LENGTH: 32,
  POOL: BASE62,
  PREFIX: "sk",
  SEPARATOR: "_",
} as const;

const OFFSETS = [0, 13, 29, 37, 43, 53, 61, 71];
const PRIMES = [1, 7, 11, 17, 23, 29, 37, 41];

//
//
// Types
//

interface JaypieKeyOptions {
  checksum?: number;
  issuer?: string;
  length?: number;
  pool?: string;
  prefix?: string;
  seed?: string;
  separator?: string;
}

interface HashOptions {
  salt?: string;
}

//
//
// Internal
//

function computeChecksum(
  body: string,
  pool: string,
  checksumLength: number,
): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += body.charCodeAt(i);
  }
  let result = "";
  for (let i = 0; i < checksumLength; i++) {
    result +=
      pool[
        (sum * PRIMES[i % PRIMES.length] + OFFSETS[i % OFFSETS.length]) %
          pool.length
      ];
  }
  return result;
}

//
//
// Main
//

function generateJaypieKey({
  checksum = DEFAULTS.CHECKSUM,
  issuer,
  length = DEFAULTS.LENGTH,
  pool = DEFAULTS.POOL,
  prefix = DEFAULTS.PREFIX,
  seed,
  separator = DEFAULTS.SEPARATOR,
}: JaypieKeyOptions = {}): string {
  let bytes: Buffer;
  if (seed) {
    const hmac = createHmac("sha256", seed);
    hmac.update(issuer ?? "jaypie");
    bytes = hmac.digest();
  } else {
    bytes = randomBytes(length);
  }
  let body = "";
  for (let i = 0; i < length; i++) {
    body += pool[bytes[i] % pool.length];
  }

  const parts: string[] = [];
  if (prefix) parts.push(prefix);
  if (issuer) parts.push(issuer);

  let result = "";
  if (parts.length > 0) {
    result = parts.join(separator) + separator;
  }
  result += body;
  if (checksum > 0) {
    const checksumStr = computeChecksum(body, pool, checksum);
    result += separator + checksumStr;
  }
  return result;
}

function hashJaypieKey(key: string, { salt }: HashOptions = {}): string {
  const resolvedSalt = salt ?? process.env.PROJECT_SALT;

  if (resolvedSalt === undefined) {
    log.warn("hashJaypieKey called without salt or PROJECT_SALT");
  }

  if (resolvedSalt) {
    return createHmac("sha256", resolvedSalt).update(key).digest("hex");
  }
  return createHash("sha256").update(key).digest("hex");
}

function validateJaypieKey(
  key: string,
  {
    checksum = DEFAULTS.CHECKSUM,
    issuer,
    length = DEFAULTS.LENGTH,
    pool = DEFAULTS.POOL,
    prefix = DEFAULTS.PREFIX,
  }: JaypieKeyOptions = {},
): boolean {
  if (typeof key !== "string") return false;

  const poolSet = new Set(pool);
  const separators = ["_", "-"];

  // Build prefix candidates to try (prefix and checksum are not required)
  const prefixCandidates = new Set<string>();

  for (const sep of separators) {
    const parts: string[] = [];
    if (prefix) parts.push(prefix);
    if (issuer) parts.push(issuer);

    if (parts.length > 0) {
      prefixCandidates.add(parts.join(sep) + sep);
    }

    // Without the prefix part, just issuer
    if (prefix && issuer) {
      prefixCandidates.add(issuer + sep);
    }
  }

  // No prefix at all (only when issuer is not specified)
  if (!issuer) {
    prefixCandidates.add("");
  }

  for (const prefixStr of prefixCandidates) {
    if (!key.startsWith(prefixStr)) continue;

    const remainder = key.slice(prefixStr.length);
    if (remainder.length < length) continue;

    const body = remainder.slice(0, length);

    // Validate all body chars are in pool
    let bodyValid = true;
    for (const char of body) {
      if (!poolSet.has(char)) {
        bodyValid = false;
        break;
      }
    }
    if (!bodyValid) continue;

    const tail = remainder.slice(length);

    // No tail — valid (checksum not required)
    if (tail.length === 0) return true;

    // If checksum is disabled, extra chars means invalid for this interpretation
    if (checksum <= 0) continue;

    // Try: separator + checksum
    if (tail.length === 1 + checksum && (tail[0] === "_" || tail[0] === "-")) {
      const checksumStr = tail.slice(1);
      if (checksumStr === computeChecksum(body, pool, checksum)) {
        return true;
      }
    }

    // Try: checksum directly (no separator)
    if (tail.length === checksum) {
      if (tail === computeChecksum(body, pool, checksum)) {
        return true;
      }
    }
  }

  return false;
}

//
//
// Export
//

export { generateJaypieKey, hashJaypieKey, validateJaypieKey };
export type { HashOptions, JaypieKeyOptions };
