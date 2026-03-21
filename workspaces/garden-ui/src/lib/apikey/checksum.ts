const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_SET = new Set(BASE62);
const BODY_LENGTH = 32;
const CHECKSUM_LENGTH = 4;
const OFFSETS = [0, 13, 29, 37, 43, 53, 61, 71];
const PREFIX = "sk_jaypie_";
const PRIMES = [1, 7, 11, 17, 23, 29, 37, 41];

//
//
// Main
//

function computeChecksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += body.charCodeAt(i);
  }
  let result = "";
  for (let i = 0; i < CHECKSUM_LENGTH; i++) {
    result +=
      BASE62[
        (sum * PRIMES[i % PRIMES.length] + OFFSETS[i % OFFSETS.length]) %
          BASE62.length
      ];
  }
  return result;
}

/**
 * Client-safe format validation for Jaypie API keys.
 * Accepts `sk_jaypie_<body>_<checksum>` and `sk_jaypie_<body><checksum>`.
 */
function isValidApiKeyFormat(key: string): boolean {
  if (typeof key !== "string") return false;
  if (!key.startsWith(PREFIX)) return false;

  const remainder = key.slice(PREFIX.length);

  // Validate all remainder chars are base62 or underscore separator
  for (const char of remainder) {
    if (!BASE62_SET.has(char) && char !== "_") return false;
  }

  // Try: body_checksum (with separator)
  if (remainder.length === BODY_LENGTH + 1 + CHECKSUM_LENGTH) {
    const body = remainder.slice(0, BODY_LENGTH);
    if (remainder[BODY_LENGTH] === "_") {
      const checksum = remainder.slice(BODY_LENGTH + 1);
      if (checksum === computeChecksum(body)) return true;
    }
  }

  // Try: bodychecksum (no separator)
  if (remainder.length === BODY_LENGTH + CHECKSUM_LENGTH) {
    const body = remainder.slice(0, BODY_LENGTH);
    const checksum = remainder.slice(BODY_LENGTH);
    if (checksum === computeChecksum(body)) return true;
  }

  // Body only (no checksum)
  if (remainder.length === BODY_LENGTH) return true;

  return false;
}

//
//
// Export
//

export { computeChecksum, isValidApiKeyFormat };
