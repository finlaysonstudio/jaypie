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
  separator = DEFAULTS.SEPARATOR,
}: JaypieKeyOptions = {}): string {
  const bytes = randomBytes(length);
  let body = "";
  for (let i = 0; i < length; i++) {
    body += pool[bytes[i] % pool.length];
  }

  const checksumStr = computeChecksum(body, pool, checksum);
  const parts = [prefix];
  if (issuer) {
    parts.push(issuer);
  }
  return parts.join(separator) + separator + body + separator + checksumStr;
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
    separator = DEFAULTS.SEPARATOR,
  }: JaypieKeyOptions = {},
): boolean {
  if (typeof key !== "string") return false;

  // Build expected prefix string
  const parts = [prefix];
  if (issuer) {
    parts.push(issuer);
  }
  const prefixStr = parts.join(separator) + separator;

  // Check total length (prefix + body + separator + checksum)
  const expectedLength = prefixStr.length + length + separator.length + checksum;
  if (key.length !== expectedLength) return false;

  // Check prefix
  if (!key.startsWith(prefixStr)) return false;

  // Extract body and checksum (separated by separator)
  const body = key.slice(prefixStr.length, prefixStr.length + length);
  const checksumStr = key.slice(prefixStr.length + length + separator.length);

  // Validate all body chars are in pool
  const poolSet = new Set(pool);
  for (const char of body) {
    if (!poolSet.has(char)) return false;
  }

  // Validate checksum chars are in pool
  for (const char of checksumStr) {
    if (!poolSet.has(char)) return false;
  }

  // Verify checksum
  return checksumStr === computeChecksum(body, pool, checksum);
}

//
//
// Export
//

export { generateJaypieKey, hashJaypieKey, validateJaypieKey };
export type { HashOptions, JaypieKeyOptions };
