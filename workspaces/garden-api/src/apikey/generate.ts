import { createHmac, createHash } from "node:crypto";

import { computeChecksum } from "./checksum.js";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BODY_LENGTH = 32;
const HMAC_CONTEXT = "jaypie-garden-owner-key-v1";
const PREFIX = "sk_jpi_";

//
//
// Main
//

function generateKeyFromSeed(seed: string): string {
  const hmac = createHmac("sha256", seed);
  hmac.update(HMAC_CONTEXT);
  const bytes = hmac.digest();

  let body = "";
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += BASE62[bytes[i] % 62];
  }

  const checksum = computeChecksum(body);
  return `${PREFIX}${body}${checksum}`;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

//
//
// Export
//

export { generateKeyFromSeed, hashKey };
