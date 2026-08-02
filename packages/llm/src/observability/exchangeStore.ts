import { ConfigurationError } from "@jaypie/errors";

import { LlmExchangeEnvelope } from "../types/LlmProvider.interface.js";
import { getLogger } from "../util/index.js";
import { isExchangeStoreEnabled } from "../operate/exchange/emitExchange.js";

//
//
// Types
//

/** The `storeExchange` signature, whether standalone or on a module. */
export type ExchangeStoreFunction = (
  envelope: LlmExchangeEnvelope,
) => Promise<unknown> | unknown;

/** Minimal shape of the @jaypie/dynamodb surface this module uses. */
interface ExchangeStoreSdk {
  storeExchange: ExchangeStoreFunction;
}

/**
 * What a host may register: the `@jaypie/dynamodb` module namespace, a
 * namespace whose surface hangs off `default`, or a bare `storeExchange`.
 */
export type ExchangeStore =
  ExchangeStoreFunction | ExchangeStoreSdk | { default: ExchangeStoreSdk };

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

// Native dynamic import that neither rollup nor tsc rewrites to require(), so
// a CJS-bundled build still loads @jaypie/dynamodb's ESM entry and shares the
// host's initialized module instance. A require()-based resolution would load
// the CJS build, whose module-level client state is separate from the ESM
// instance an ESM host initializes (dual-package hazard, issue #429).
const dynamicImport = new Function("s", "return import(s)") as (
  s: string,
) => Promise<Record<string, unknown>>;

let resolved = false;
let cachedSdk: ExchangeStoreSdk | null = null;
let injectedSdk: ExchangeStoreSdk | null = null;
let registeredSdk: ExchangeStoreSdk | null = null;

/**
 * Coerce a registered or resolved value to the store surface. Accepts a bare
 * function, a module namespace carrying `storeExchange`, or one wrapping it
 * under `default`. Returns null when nothing usable is present.
 */
function toExchangeStoreSdk(store: unknown): ExchangeStoreSdk | null {
  if (typeof store === "function") {
    return { storeExchange: store as ExchangeStoreFunction };
  }
  if (!store) {
    return null;
  }
  // Prefer the value itself: a namespace may carry an unrelated `default`
  const candidates = [store, (store as { default?: unknown }).default];
  for (const candidate of candidates) {
    if (typeof (candidate as ExchangeStoreSdk)?.storeExchange === "function") {
      return candidate as ExchangeStoreSdk;
    }
  }
  return null;
}

/**
 * Lazily resolve @jaypie/dynamodb's storeExchange. Returns null (and never
 * throws) when the peer is absent. Cached after the first attempt.
 */
async function resolveExchangeStore(): Promise<ExchangeStoreSdk | null> {
  if (resolved) {
    return cachedSdk;
  }
  resolved = true;
  try {
    cachedSdk = toExchangeStoreSdk(await dynamicImport(MODULE.JAYPIE_DYNAMODB));
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
  registeredSdk = null;
}

/**
 * Inject a store to bypass @jaypie/dynamodb resolution. Test-only: the peer
 * is optional, so the enabled path cannot otherwise be exercised in unit
 * tests without it installed. Hosts use `useExchangeStore`.
 */
export function _setExchangeStore(sdk: ExchangeStoreSdk | null): void {
  injectedSdk = sdk;
}

//
//
// Main
//

/**
 * Register the `@jaypie/dynamodb` instance exchange persistence should use,
 * bypassing the dynamic import. Call once at bootstrap, beside `initClient()`.
 *
 * The dynamic import resolves from `node_modules`, which reaches a different
 * copy than the one a host holds when its `@jaypie/dynamodb` is
 * bundler-managed — that copy is initialized, the imported one is not, and
 * every exchange is dropped (issue #474). Registration names the instance.
 *
 * ```typescript
 * import * as dynamodb from "@jaypie/dynamodb";
 * import { Llm } from "@jaypie/llm";
 *
 * dynamodb.initClient();
 * Llm.useExchangeStore(dynamodb);
 * ```
 *
 * Pass `null` to clear the registration and fall back to the dynamic import.
 *
 * @throws ConfigurationError when the value carries no `storeExchange`
 */
export function useExchangeStore(store: ExchangeStore | null): void {
  if (store === null || store === undefined) {
    registeredSdk = null;
    return;
  }
  const sdk = toExchangeStoreSdk(store);
  if (!sdk) {
    throw new ConfigurationError(
      "useExchangeStore requires a storeExchange function or a module exporting one",
    );
  }
  registeredSdk = sdk;
}

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
  const sdk = injectedSdk ?? registeredSdk ?? (await resolveExchangeStore());
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
