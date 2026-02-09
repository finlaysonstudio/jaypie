const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_SET = new Set(BASE62);
const BODY_LENGTH = 32;
const KEY_LENGTH = 41;
const PREFIX = "sk-jpi-";

//
//
// Main
//

function computeChecksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += body.charCodeAt(i);
  }
  const c0 = BASE62[sum % 62];
  const c1 = BASE62[(sum * 7 + 13) % 62];
  return `${c0}${c1}`;
}

function isValidApiKeyFormat(key: string): boolean {
  if (typeof key !== "string") return false;
  if (key.length !== KEY_LENGTH) return false;
  if (!key.startsWith(PREFIX)) return false;

  const body = key.slice(PREFIX.length, PREFIX.length + BODY_LENGTH);
  const checksum = key.slice(PREFIX.length + BODY_LENGTH);

  // Validate all body chars are base62
  for (const char of body) {
    if (!BASE62_SET.has(char)) return false;
  }

  // Validate checksum chars are base62
  for (const char of checksum) {
    if (!BASE62_SET.has(char)) return false;
  }

  return checksum === computeChecksum(body);
}

//
//
// Export
//

export { computeChecksum, isValidApiKeyFormat };
