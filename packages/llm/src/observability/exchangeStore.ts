import { createRequire } from "module";
import { pathToFileURL } from "url";

import { LlmExchangeEnvelope } from "../types/LlmProvider.interface.js";
import { getLogger } from "../util/index.js";
import { isExchangeStoreEnabled } from "../operate/exchange/emitExchange.js";

//
//
// Types
//

/** Minimal shape of the @jaypie/dynamodb surface this module uses. */
interface ExchangeStoreSdk {
  storeExchange: (envelope: LlmExchangeEnvelope) => Promise<unknown>;
}

//
//
// Constants
//

const MODULE = {
  // Computed at runtime so bundlers (esbuild) do not attempt to include
  // @jaypie/dynamodb, which is an optional peer dependency.
  JAYPIE_DYNAMODB: ["@jaypie", "dynamodb"].join("/"),
};

//
//
// Helpers
//

// CJS/ESM compatible require - handles bundling to CJS where import.meta.url
// becomes undefined (mirrors observability/llmobs.ts).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - __filename exists in CJS context when ESM is bundled to CJS
const requireModule =
  typeof __filename !== "undefined"
    ? createRequire(pathToFileURL(__filename).href)
    : createRequire(import.meta.url);

let resolved = false;
let cachedSdk: ExchangeStoreSdk | null = null;
let injectedSdk: ExchangeStoreSdk | null = null;

/**
 * Lazily resolve @jaypie/dynamodb's storeExchange. Returns null (and never
 * throws) when the peer is absent. Cached after the first attempt.
 */
function resolveExchangeStore(): ExchangeStoreSdk | null {
  if (resolved) {
    return cachedSdk;
  }
  resolved = true;
  try {
    const dynamodb = requireModule(MODULE.JAYPIE_DYNAMODB);
    const sdk = dynamodb?.default ?? dynamodb;
    if (sdk && typeof sdk.storeExchange === "function") {
      cachedSdk = sdk as ExchangeStoreSdk;
    }
  } catch {
    cachedSdk = null;
  }
  return cachedSdk;
}

/** Reset the cached resolution. Exposed for tests. */
export function _resetExchangeStore(): void {
  resolved = false;
  cachedSdk = null;
  injectedSdk = null;
}

/**
 * Inject a store to bypass @jaypie/dynamodb resolution. Test-only: the peer
 * is optional, so the enabled path cannot otherwise be exercised in unit
 * tests without it installed.
 */
export function _setExchangeStore(sdk: ExchangeStoreSdk | null): void {
  injectedSdk = sdk;
}

//
//
// Main
//

/**
 * Persist an exchange envelope via @jaypie/dynamodb when
 * LLM_EXCHANGE_ENABLED is set. Silent no-op when the flag is unset or the
 * peer is absent; persister failures are logged and never thrown.
 */
export async function persistExchange(
  envelope: LlmExchangeEnvelope,
): Promise<void> {
  if (!isExchangeStoreEnabled()) {
    return;
  }
  const sdk = injectedSdk ?? resolveExchangeStore();
  if (!sdk) {
    return;
  }
  try {
    await sdk.storeExchange(envelope);
  } catch (error) {
    const log = getLogger();
    log.warn("[operate] Exchange persistence failed");
    log.var({ error });
  }
}
