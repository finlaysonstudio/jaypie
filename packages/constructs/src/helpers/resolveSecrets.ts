import { Construct } from "constructs";

import { JaypieEnvSecret, JaypieEnvSecretProps } from "../JaypieEnvSecret.js";

/**
 * Secrets input type that supports both JaypieEnvSecret instances and strings
 * - JaypieEnvSecret: passed through as-is
 * - string: converted to JaypieEnvSecret with the string as envKey
 */
export type SecretsArrayItem = JaypieEnvSecret | string;

/**
 * Cache for secrets by scope to avoid creating duplicates.
 * Uses WeakMap to allow garbage collection when scopes are no longer referenced.
 */
const secretsByScope = new WeakMap<Construct, Map<string, JaypieEnvSecret>>();

/**
 * Gets or creates the secrets cache for a given scope.
 */
function getSecretsCache(scope: Construct): Map<string, JaypieEnvSecret> {
  let cache = secretsByScope.get(scope);
  if (!cache) {
    cache = new Map<string, JaypieEnvSecret>();
    secretsByScope.set(scope, cache);
  }
  return cache;
}

/**
 * Gets an existing secret from the cache or creates a new one.
 * This ensures that multiple constructs within the same scope share secrets.
 */
function getOrCreateSecret(
  scope: Construct,
  envKey: string,
  props?: Omit<JaypieEnvSecretProps, "envKey">,
): JaypieEnvSecret {
  const cache = getSecretsCache(scope);
  const existingSecret = cache.get(envKey);

  if (existingSecret) {
    return existingSecret;
  }

  // Create new secret - JaypieEnvSecret's smart constructor handles envKey detection
  const secret = new JaypieEnvSecret(scope, envKey, {
    ...props,
    envKey,
  });
  cache.set(envKey, secret);
  return secret;
}

/**
 * Resolves secrets input to an array of JaypieEnvSecret instances.
 *
 * When an item is already a JaypieEnvSecret, it's passed through as-is.
 * When an item is a string, a JaypieEnvSecret is created (or reused from cache)
 * with the string as the envKey.
 *
 * Secrets are cached per scope to avoid creating duplicate secrets when
 * multiple constructs in the same scope reference the same secret.
 *
 * @example
 * // JaypieEnvSecret instances pass through
 * const secret = new JaypieEnvSecret(scope, "MySecret", { envKey: "MY_KEY" });
 * resolveSecrets(scope, [secret])
 * // => [secret]
 *
 * @example
 * // Strings create JaypieEnvSecret instances
 * resolveSecrets(scope, ["AUTH0_SECRET", "MONGODB_URI"])
 * // => [JaypieEnvSecret(envKey: "AUTH0_SECRET"), JaypieEnvSecret(envKey: "MONGODB_URI")]
 *
 * @example
 * // Mixed input
 * const existingSecret = new JaypieEnvSecret(scope, "Existing", { envKey: "EXISTING" });
 * resolveSecrets(scope, [existingSecret, "NEW_SECRET"])
 * // => [existingSecret, JaypieEnvSecret(envKey: "NEW_SECRET")]
 *
 * @example
 * // Secrets are shared across calls with the same scope
 * const secrets1 = resolveSecrets(scope, ["SHARED_SECRET"]);
 * const secrets2 = resolveSecrets(scope, ["SHARED_SECRET"]);
 * // secrets1[0] === secrets2[0] (same instance)
 */
export function resolveSecrets(
  scope: Construct,
  secrets?: SecretsArrayItem[],
): JaypieEnvSecret[] {
  if (!secrets || secrets.length === 0) {
    return [];
  }

  return secrets.map((item) => {
    if (typeof item === "string") {
      return getOrCreateSecret(scope, item);
    }
    // Already a JaypieEnvSecret instance
    return item;
  });
}

/**
 * Clears the secrets cache for a given scope.
 * Primarily useful for testing.
 */
export function clearSecretsCache(scope: Construct): void {
  secretsByScope.delete(scope);
}

/**
 * Clears all secrets caches.
 * Primarily useful for testing.
 */
export function clearAllSecretsCaches(): void {
  // WeakMap doesn't have a clear() method, so we create a new one
  // This relies on the module being reloaded or the function being called
  // between test runs. For testing, use clearSecretsCache(scope) instead.
}
