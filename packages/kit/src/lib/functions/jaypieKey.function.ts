import { createHash, createHmac, randomBytes } from "node:crypto";

import { UnauthorizedError } from "@jaypie/errors";
import { log } from "@jaypie/logger";
import { v5 as uuidv5 } from "uuid";

import { isProductionEnv } from "../../isProductionEnv.js";

//
//
// Constants
//

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const BYTE_VALUES = 256;
const RANDOM_BLOCK_BYTES = 32;

const CHECKSUM_LENGTH = {
  LEGACY: 4,
  VERSION_2: 5,
} as const;

const DEFAULTS = {
  CHECKSUM: true,
  LENGTH: 32,
  POOL: BASE62,
  PREFIX: "sk",
  SEPARATOR: "_",
} as const;

const ENVIRONMENT_PRODUCTION = "production";

const HASH_MODULUS = 2147483647;
const HASH_MULTIPLIER = 31;

const HMAC_ALGORITHM = "sha256";

const MESSAGE = {
  NON_PRODUCTION_KEY: "The provided key matches a non-production environment",
} as const;

const OFFSETS = [0, 13, 29, 37, 43, 53, 61, 71];
const PRIMES = [1, 7, 11, 17, 23, 29, 37, 41];

const SEED_CONTEXT = "jaypie";
const SEED_SEPARATOR = ":";
const SEED_VERSION_TAG = "v2";

const SEPARATOR_PATTERN = /[_-]/;

const VERSION = {
  CURRENT: 2,
  LEGACY: 1,
} as const;

//
//
// Types
//

type JaypieKeyVersion = 1 | 2;

interface JaypieKeyOptions {
  /** Truthy emits a checksum; only the current five-character checksum is generated */
  checksum?: boolean | number;
  /** Segment between issuer and body; defaults to `PROJECT_ENV`, omitted in production or when `false` */
  environment?: string | false | null;
  issuer?: string;
  length?: number;
  pool?: string;
  prefix?: string;
  seed?: string;
  separator?: string;
  /** `1` reproduces keys minted before the five-character checksum */
  version?: JaypieKeyVersion;
}

interface HashOptions {
  salt?: string;
}

interface ApiKeyIdOptions {
  namespace: string;
  salt?: string;
}

//
//
// Internal
//

// Order-insensitive sum, kept so keys minted before the five-character checksum
// keep validating. Never used to mint a new key except with `version: 1`.
function legacyChecksum(
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

// Polynomial rolling hash, so the checksum depends on character order and a
// transposed pair no longer sums to the same value. Five characters, which is
// also how validation tells this checksum from the legacy four.
function currentChecksum(body: string, pool: string): string {
  let hash = 0;
  for (let i = 0; i < body.length; i++) {
    hash = (hash * HASH_MULTIPLIER + body.charCodeAt(i)) % HASH_MODULUS;
  }
  let result = "";
  for (let i = 0; i < CHECKSUM_LENGTH.VERSION_2; i++) {
    result +=
      pool[
        (hash * PRIMES[i % PRIMES.length] + OFFSETS[i % OFFSETS.length]) %
          pool.length
      ];
  }
  return result;
}

// Byte source for version 2. A seed derives bytes in counter mode, so a body
// longer than one digest reads real bytes instead of running off the end, and
// rejection sampling can draw as many bytes as it discards. The counter message
// carries a version tag, so a version 2 derivation can never collide with the
// version 1 digest for the same seed and issuer.
function createByteReader({
  seed,
  context,
}: {
  context: string;
  seed?: string;
}): () => number {
  let block = Buffer.alloc(0);
  let counter = 0;
  let offset = 0;
  return () => {
    if (offset >= block.length) {
      block = seed
        ? createHmac(HMAC_ALGORITHM, seed)
            .update([context, SEED_VERSION_TAG, counter].join(SEED_SEPARATOR))
            .digest()
        : randomBytes(RANDOM_BLOCK_BYTES);
      counter += 1;
      offset = 0;
    }
    const byte = block[offset];
    offset += 1;
    return byte;
  };
}

function legacyBody({
  context,
  length,
  pool,
  seed,
}: {
  context: string;
  length: number;
  pool: string;
  seed?: string;
}): string {
  let bytes: Buffer;
  if (seed) {
    const hmac = createHmac(HMAC_ALGORITHM, seed);
    hmac.update(context);
    bytes = hmac.digest();
  } else {
    bytes = randomBytes(length);
  }
  let body = "";
  for (let i = 0; i < length; i++) {
    body += pool[bytes[i] % pool.length];
  }
  return body;
}

// Rejection sampling. 256 is not a multiple of 62, so a plain modulo favors the
// first eight characters of base62; discarding the short tail of the byte range
// leaves every pool character equally likely. A pool larger than a byte has no
// tail to discard and falls back to modulo.
function currentBody({
  context,
  length,
  pool,
  seed,
}: {
  context: string;
  length: number;
  pool: string;
  seed?: string;
}): string {
  const nextByte = createByteReader({ context, seed });
  const limit = Math.floor(BYTE_VALUES / pool.length) * pool.length;
  let body = "";
  while (body.length < length) {
    const byte = nextByte();
    if (limit > 0 && byte >= limit) continue;
    body += pool[byte % pool.length];
  }
  return body;
}

// The segment is a hint carried in the key, so it must survive splitting on
// either separator. Anything outside the alphanumeric range is dropped, which
// keeps an environment such as `pr-123` from reading as two segments.
function resolveEnvironment(
  environment: string | false | null | undefined,
): string | undefined {
  if (environment === false || environment === null) return undefined;
  const value = environment ?? process.env.PROJECT_ENV;
  if (!value) return undefined;
  if (value === ENVIRONMENT_PRODUCTION) return undefined;
  const sanitized = value.replace(/[^0-9A-Za-z]/g, "");
  return sanitized || undefined;
}

//
//
// Main
//

function generateJaypieKey({
  checksum = DEFAULTS.CHECKSUM,
  environment,
  issuer,
  length = DEFAULTS.LENGTH,
  pool = DEFAULTS.POOL,
  prefix = DEFAULTS.PREFIX,
  seed,
  separator = DEFAULTS.SEPARATOR,
  version = VERSION.CURRENT,
}: JaypieKeyOptions = {}): string {
  const legacy = version === VERSION.LEGACY;
  const context = issuer ?? SEED_CONTEXT;
  const body = legacy
    ? legacyBody({ context, length, pool, seed })
    : currentBody({ context, length, pool, seed });

  const parts: string[] = [];
  if (prefix) parts.push(prefix);
  if (issuer) parts.push(issuer);
  if (!legacy) {
    const resolvedEnvironment = resolveEnvironment(environment);
    if (resolvedEnvironment) parts.push(resolvedEnvironment);
  }

  let result = "";
  if (parts.length > 0) {
    result = parts.join(separator) + separator;
  }
  result += body;
  if (checksum) {
    result +=
      separator +
      (legacy
        ? legacyChecksum(body, pool, CHECKSUM_LENGTH.LEGACY)
        : currentChecksum(body, pool));
  }
  return result;
}

function jaypieApiKeyId(
  key: string,
  { namespace, salt }: ApiKeyIdOptions,
): string {
  return uuidv5(hashJaypieKey(key, { salt }), namespace);
}

function hashJaypieKey(key: string, { salt }: HashOptions = {}): string {
  const resolvedSalt = salt ?? process.env.PROJECT_SALT;

  if (resolvedSalt === undefined) {
    log.warn("hashJaypieKey called without salt or PROJECT_SALT");
  }

  if (resolvedSalt) {
    return createHmac(HMAC_ALGORITHM, resolvedSalt).update(key).digest("hex");
  }
  return createHash(HMAC_ALGORITHM).update(key).digest("hex");
}

function isPoolString(value: string, pool: Set<string>): boolean {
  for (const char of value) {
    if (!pool.has(char)) return false;
  }
  return true;
}

// A checksum is never required. When one is present it must be four characters
// matching the legacy sum or five matching the current algorithm.
function isChecksumValid({
  body,
  checksum,
  pool,
}: {
  body: string;
  checksum: string;
  pool: string;
}): boolean {
  if (checksum.length === CHECKSUM_LENGTH.VERSION_2) {
    return checksum === currentChecksum(body, pool);
  }
  if (checksum.length === CHECKSUM_LENGTH.LEGACY) {
    return checksum === legacyChecksum(body, pool, CHECKSUM_LENGTH.LEGACY);
  }
  return false;
}

function validateJaypieKey(
  key: string,
  {
    checksum = DEFAULTS.CHECKSUM,
    environment,
    issuer,
    length = DEFAULTS.LENGTH,
    pool = DEFAULTS.POOL,
    prefix = DEFAULTS.PREFIX,
  }: JaypieKeyOptions = {},
): boolean {
  if (typeof key !== "string") return false;
  if (key.length === 0) return false;

  const poolSet = new Set(pool);
  const segments = key.split(SEPARATOR_PATTERN);

  // Candidate splits of the trailing segments into body and checksum. The
  // checksum may stand alone, follow the body without a separator, or be absent
  const candidates: Array<{ body: string; checksum: string; lead: string[] }> =
    [];
  const last = segments[segments.length - 1];
  if (last.length === length) {
    candidates.push({ body: last, checksum: "", lead: segments.slice(0, -1) });
  }
  for (const checksumLength of [
    CHECKSUM_LENGTH.LEGACY,
    CHECKSUM_LENGTH.VERSION_2,
  ]) {
    if (last.length === length + checksumLength) {
      candidates.push({
        body: last.slice(0, length),
        checksum: last.slice(length),
        lead: segments.slice(0, -1),
      });
    }
    if (
      segments.length >= 2 &&
      last.length === checksumLength &&
      segments[segments.length - 2].length === length
    ) {
      candidates.push({
        body: segments[segments.length - 2],
        checksum: last,
        lead: segments.slice(0, -2),
      });
    }
  }

  const production = isProductionEnv();
  const resolvedEnvironment = resolveEnvironment(environment);
  let environmentMismatch = false;

  for (const candidate of candidates) {
    if (!isPoolString(candidate.body, poolSet)) continue;
    if (candidate.checksum) {
      if (!checksum) continue;
      if (!isPoolString(candidate.checksum, poolSet)) continue;
      if (
        !isChecksumValid({
          body: candidate.body,
          checksum: candidate.checksum,
          pool,
        })
      ) {
        continue;
      }
    }

    // Leading segments are, in order, an optional prefix, the issuer when one is
    // expected, and an optional environment
    const lead = [...candidate.lead];
    if (prefix && lead[0] === prefix) lead.shift();
    if (issuer) {
      if (lead[0] !== issuer) continue;
      lead.shift();
    }
    if (lead.length === 0) return true;
    if (lead.length > 1) continue;

    // A single unclaimed segment is the environment. With an issuer the layout
    // is unambiguous, so any environment is accepted outside production and
    // rejected within it. Without an issuer the segment is indistinguishable
    // from an issuer, so it must match the environment being validated against
    if (issuer) {
      if (!production) return true;
      environmentMismatch = true;
      continue;
    }
    if (resolvedEnvironment && lead[0] === resolvedEnvironment) return true;
  }

  if (environmentMismatch) {
    throw new UnauthorizedError(MESSAGE.NON_PRODUCTION_KEY);
  }

  return false;
}

//
//
// Export
//

export { generateJaypieKey, hashJaypieKey, jaypieApiKeyId, validateJaypieKey };
export type {
  ApiKeyIdOptions,
  HashOptions,
  JaypieKeyOptions,
  JaypieKeyVersion,
};
