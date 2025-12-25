import { JAYPIE } from "@jaypie/kit";
import { log } from "@jaypie/logger";

import getEnvSecret from "./getEnvSecret.function.js";

//
//
// Types
//

type SecretInput = string | string[];

interface JaypieLogger {
  trace: {
    var: (data: Record<string, unknown>) => void;
  };
  var: (data: Record<string, unknown>) => void;
}

//
//
// Main
//

/**
 * Load environment secrets by name and set them in process.env
 *
 * @param secrets - Secret names to load. Can be strings or arrays of strings.
 * @returns Promise that resolves when all secrets are loaded
 *
 * @example
 * // Load single secrets
 * await loadEnvSecrets("ANTHROPIC_API_KEY", "OPENAI_API_KEY");
 *
 * @example
 * // Load with arrays (useful for grouping)
 * await loadEnvSecrets(["DB_PASSWORD", "DB_USER"], "API_KEY");
 */
async function loadEnvSecrets(...secrets: SecretInput[]): Promise<void> {
  const logger = log.lib({ lib: JAYPIE.LIB.AWS }) as unknown as JaypieLogger;
  logger.trace.var({ loadEnvSecrets: secrets });

  // Flatten all inputs into a single array of secret names
  const secretNames: string[] = [];
  for (const input of secrets) {
    if (Array.isArray(input)) {
      secretNames.push(...input);
    } else {
      secretNames.push(input);
    }
  }

  // Load each secret and set in process.env if found
  await Promise.all(
    secretNames.map(async (name) => {
      const value = await getEnvSecret(name);
      if (value !== undefined) {
        process.env[name] = value;
        logger.var({ [`loadedSecret:${name}`]: true });
      }
    }),
  );
}

//
//
// Export
//

export default loadEnvSecrets;
