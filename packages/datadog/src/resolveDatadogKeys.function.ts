import { getEnvSecret, getSecret } from "@jaypie/aws";

import { DATADOG } from "./constants.js";

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
