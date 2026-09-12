import { getEnvSecret, getSecret } from "@jaypie/aws";

import { DATADOG } from "./constants.js";

//
//
// Constants
//

/**
 * Every variable that can supply the Datadog API key, in resolution order.
 * Each name also counts through its `SECRET_<NAME>` and `<NAME>_SECRET`
 * references (see `findDatadogKeySource`).
 */
export const DATADOG_API_KEY_ENV = [
  DATADOG.ENV.SECRET_DATADOG_API_KEY,
  DATADOG.ENV.DATADOG_API_KEY_ARN,
  DATADOG.ENV.DD_API_KEY_SECRET_ARN,
  DATADOG.ENV.DATADOG_API_KEY,
  DATADOG.ENV.DD_API_KEY,
];

/** Every variable that can supply the Datadog application key. */
export const DATADOG_APP_KEY_ENV = [
  DATADOG.ENV.DATADOG_APP_KEY,
  DATADOG.ENV.DATADOG_APPLICATION_KEY,
  DATADOG.ENV.DD_APP_KEY,
  DATADOG.ENV.DD_APPLICATION_KEY,
];

//
//
// Types
//

interface ResolveDatadogApiKeyOptions {
  apiKey?: string;
  apiSecret?: string;
}

//
//
// Helpers
//

/**
 * Resolve the first of `names` that `getEnvSecret` can supply.
 *
 * `getEnvSecret` reads `SECRET_<NAME>` or `<NAME>_SECRET` as a Secrets Manager
 * reference and falls back to the plain variable, so a deferred secret never
 * has to be written into `process.env` by the caller.
 */
async function firstEnvSecret(names: string[]): Promise<string | undefined> {
  for (const name of names) {
    const value = await getEnvSecret(name);
    if (value) return value;
  }
  return undefined;
}

/**
 * Report which environment variable supplies a key, without resolving it.
 *
 * A `SECRET_<NAME>` or `<NAME>_SECRET` reference counts as present, because
 * `getEnvSecret` resolves it at call time. Reporting only the plain variable
 * would say a key is missing while every call succeeds.
 */
export function findDatadogKeySource(names: string[]): string | null {
  for (const name of names) {
    if (process.env[`SECRET_${name}`]) return `SECRET_${name}`;
    if (process.env[`${name}_SECRET`]) return `${name}_SECRET`;
    if (process.env[name]) return name;
  }
  return null;
}

//
//
// Main
//

/**
 * Resolve the Datadog API key.
 *
 * Order: an explicit secret name, then an explicit key, then the environment.
 * An explicit secret wins over an explicit key, which is the precedence the
 * metric adapters have always used.
 *
 * The `*_ARN` variables and `SECRET_DATADOG_API_KEY` keep resolving through
 * `getSecret`. `getEnvSecret` requires `AWS_SESSION_TOKEN` before it will read
 * a secret reference, so routing those through it would break a consumer that
 * resolves Datadog keys outside Lambda with ambient credentials.
 */
export async function resolveDatadogApiKey({
  apiKey,
  apiSecret,
}: ResolveDatadogApiKeyOptions = {}): Promise<string | undefined> {
  const secretName =
    apiSecret ||
    process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] ||
    process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] ||
    process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN];
  if (secretName) {
    return getSecret(secretName);
  }
  if (apiKey) {
    return apiKey;
  }
  return firstEnvSecret([DATADOG.ENV.DATADOG_API_KEY, DATADOG.ENV.DD_API_KEY]);
}

/**
 * Resolve the Datadog application key, which the query APIs require alongside
 * the API key. There is no legacy ARN variable for this key, so every name
 * resolves through `getEnvSecret`.
 */
export async function resolveDatadogAppKey(
  appKey?: string,
): Promise<string | undefined> {
  if (appKey) {
    return appKey;
  }
  return firstEnvSecret([
    DATADOG.ENV.DATADOG_APP_KEY,
    DATADOG.ENV.DATADOG_APPLICATION_KEY,
    DATADOG.ENV.DD_APP_KEY,
    DATADOG.ENV.DD_APPLICATION_KEY,
  ]);
}
