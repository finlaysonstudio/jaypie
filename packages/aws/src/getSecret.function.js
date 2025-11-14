import { ConfigurationError, JAYPIE, log } from "@jaypie/core";

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import retry from "async-retry";
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

const RETRY = {
  MAX_ATTEMPTS: 1,
  MAX_TIMEOUT: 3000,
  MIN_TIMEOUT: 1000,
};

const TIMEOUT = {
  REQUEST: 3000,
};

//
//
// Main
//

/**
 * Fetch secret from AWS parameters and secrets lambda layer extension
 * @param {string} name AWS secret name to fetch
 * @returns {Promise<string>} secret value
 * @throws {ConfigurationError} if no AWS_SESSION_TOKEN available
 * @throws {ConfigurationError} if no secret name provided
 */
async function getSecret(name) {
  const logger = log.lib({ lib: JAYPIE.LIB.AWS });
  logger.trace.var({ getSecret: name });

  if (!process.env.AWS_SESSION_TOKEN) {
    throw new ConfigurationError("No AWS_SESSION_TOKEN available");
  }
  if (!name) {
    throw new ConfigurationError("No secret name provided");
  }

  const headers = {
    [HTTP.HEADER.AMAZON.PARAMETERS_SECRETS_TOKEN]:
      process.env.AWS_SESSION_TOKEN,
  };
  const port =
    process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ||
    DEFAULT.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT;
  const params = { secretId: name };
  const endpoint = `http://localhost:${port}/secretsmanager/get`;

  try {
    const response = await retry(
      async (bail) => {
        try {
          logger.trace.var({ getSecretAttempt: { name, endpoint } });
          return await axios.get(endpoint, {
            headers,
            params,
            timeout: TIMEOUT.REQUEST,
          });
        } catch (error) {
          // Log the error for observability
          logger.trace.var({
            getSecretError: {
              code: error.code,
              message: error.message,
              name: error.name,
              response: error.response?.status,
            },
          });

          // Don't retry on client errors (4xx)
          if (error.response?.status >= 400 && error.response?.status < 500) {
            logger.error("[@jaypie/aws] Client error from Secrets Extension");
            logger.debug({
              error: {
                message: error.message,
                status: error.response?.status,
              },
            });
            bail(error);
            return;
          }

          // Retry on network errors, timeouts, 5xx errors, etc.
          throw error;
        }
      },
      {
        factor: 2,
        maxTimeout: RETRY.MAX_TIMEOUT,
        minTimeout: RETRY.MIN_TIMEOUT,
        retries: RETRY.MAX_ATTEMPTS,
      },
    );

    return response.data.SecretString;
  } catch (error) {
    // Don't fall back to SDK on client errors (4xx) - these are configuration issues
    if (error.response?.status >= 400 && error.response?.status < 500) {
      throw error;
    }

    // All retries exhausted, fall back to AWS SDK
    logger.warn(
      "[@jaypie/aws] Secrets Extension failed after retries, falling back to AWS SDK",
    );
    logger.debug({
      error: {
        code: error.code,
        message: error.message,
      },
    });

    try {
      const client = new SecretsManagerClient();
      const command = new GetSecretValueCommand({ SecretId: name });
      const sdkResponse = await client.send(command);
      logger.var({ getSecretFallback: "AWS SDK" });
      return sdkResponse.SecretString;
    } catch (sdkError) {
      logger.error("[@jaypie/aws] Error fetching secret from AWS SDK");
      logger.debug({ error: sdkError });
      throw sdkError;
    }
  }
}

//
//
// Export
//

export default getSecret;
