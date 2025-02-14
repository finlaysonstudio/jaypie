import { ConfigurationError, JAYPIE, log } from "@jaypie/core";

import axios from "axios";

//
//
// Constants
//

const HTTP = {
  HEADER: {
    AMAZON: {
      PARAMETERS_SECRETS_TOKEN: "X-Aws-Parameters-Secrets-Token",
    },
  },
};

const DEFAULT = {
  PARAMETERS_SECRETS_EXTENSION_HTTP_PORT: 2773,
};

//
//
// Main
//

/**
 * Fetch secret from AWS parameters and secrets lambda layer extension using environment variables
 * @param {string} name AWS secret name to fetch
 * @param {Object} options Options object
 * @param {Object} [options.env=process.env] Environment object to use for lookup
 * @returns {Promise<string>} secret value
 * @throws {ConfigurationError} if secret requires AWS_SESSION_TOKEN but none available
 * @throws {ConfigurationError} if no secret name provided
 * @throws {ConfigurationError} if no secret found in environment
 */
async function getEnvSecret(name, { env = process.env } = {}) {
  log.lib({ lib: JAYPIE.LIB.AWS }).trace.var({ getEnvSecret: name });

  if (!name) {
    throw new ConfigurationError("No secret name provided");
  }

  // Try each environment variable pattern in order of preference
  const secretId = env[`SECRET_${name}`] || env[`${name}_SECRET`];
  const value = secretId || env[name];

  if (!value) {
    return undefined;
  }

  // Only fetch from secrets manager if it's an explicit secret reference
  if (secretId) {
    if (!env.AWS_SESSION_TOKEN) {
      throw new ConfigurationError("No AWS_SESSION_TOKEN available");
    }

    const headers = {
      [HTTP.HEADER.AMAZON.PARAMETERS_SECRETS_TOKEN]: env.AWS_SESSION_TOKEN,
    };
    const port =
      env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ||
      DEFAULT.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT;
    const params = { secretId };
    const endpoint = `http://localhost:${port}/secretsmanager/get`;
    const response = await axios.get(endpoint, { headers, params });
    return response.data.SecretString;
  }

  // If no secret reference but we have a value, return it directly
  return value;
}

//
//
// Export
//

export default getEnvSecret;
