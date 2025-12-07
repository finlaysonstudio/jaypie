import { ConfigurationError, JAYPIE, log } from "@jaypie/core";

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import retry from "async-retry";
import axios, { AxiosError } from "axios";

//
//
// Types
//

interface JaypieLogger {
  trace: {
    var: (data: Record<string, unknown>) => void;
  };
  var: (data: Record<string, unknown>) => void;
  debug: (data: unknown) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

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
 * @param name AWS secret name to fetch
 * @returns secret value
 * @throws {ConfigurationError} if no AWS_SESSION_TOKEN available
 * @throws {ConfigurationError} if no secret name provided
 */
async function getSecret(name: string): Promise<string | undefined> {
  const logger = log.lib({ lib: JAYPIE.LIB.AWS }) as unknown as JaypieLogger;
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
          const axiosError = error as AxiosError;
          // Log the error for observability
          logger.trace.var({
            getSecretError: {
              code: axiosError.code,
              message: axiosError.message,
              name: axiosError.name,
              response: axiosError.response?.status,
            },
          });

          // Don't retry on client errors (4xx)
          if (
            axiosError.response?.status &&
            axiosError.response.status >= 400 &&
            axiosError.response.status < 500
          ) {
            logger.error("[@jaypie/aws] Client error from Secrets Extension");
            logger.debug({
              error: {
                message: axiosError.message,
                status: axiosError.response?.status,
              },
            });
            bail(axiosError);
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

    return response?.data.SecretString;
  } catch (error) {
    const axiosError = error as AxiosError;
    // Don't fall back to SDK on client errors (4xx) - these are configuration issues
    if (
      axiosError.response?.status &&
      axiosError.response.status >= 400 &&
      axiosError.response.status < 500
    ) {
      throw error;
    }

    // All retries exhausted, fall back to AWS SDK
    logger.warn(
      "[@jaypie/aws] Secrets Extension failed after retries, falling back to AWS SDK",
    );
    logger.debug({
      error: {
        code: axiosError.code,
        message: axiosError.message,
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
