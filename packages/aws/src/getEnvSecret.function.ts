import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE } from "@jaypie/kit";
import { log } from "@jaypie/logger";

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

interface EnvObject {
  [key: string]: string | undefined;
}

interface GetEnvSecretOptions {
  env?: EnvObject;
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
  MAX_ATTEMPTS: 3,
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
 * Fetch secret from AWS parameters and secrets lambda layer extension using environment variables
 * @param name AWS secret name to fetch
 * @param options Options object
 * @param options.env Environment object to use for lookup
 * @returns secret value
 * @throws {ConfigurationError} if secret requires AWS_SESSION_TOKEN but none available
 * @throws {ConfigurationError} if no secret name provided
 * @throws {ConfigurationError} if no secret found in environment
 */
async function getEnvSecret(
  name: string,
  { env = process.env }: GetEnvSecretOptions = {},
): Promise<string | undefined> {
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

    const logger = log.lib({ lib: JAYPIE.LIB.AWS }) as unknown as JaypieLogger;
    const headers = {
      [HTTP.HEADER.AMAZON.PARAMETERS_SECRETS_TOKEN]: env.AWS_SESSION_TOKEN,
    };
    const port =
      env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ||
      DEFAULT.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT;
    const params = { secretId };
    const endpoint = `http://localhost:${port}/secretsmanager/get`;

    try {
      const response = await retry(
        async (bail) => {
          try {
            logger.trace.var({ getEnvSecretAttempt: { secretId, endpoint } });
            return await axios.get(endpoint, {
              headers,
              params,
              timeout: TIMEOUT.REQUEST,
            });
          } catch (error) {
            const axiosError = error as AxiosError;
            // Log the error for observability
            logger.trace.var({
              getEnvSecretError: {
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
        const command = new GetSecretValueCommand({ SecretId: secretId });
        const sdkResponse = await client.send(command);
        logger.var({ getEnvSecretFallback: "AWS SDK" });
        return sdkResponse.SecretString;
      } catch (sdkError) {
        logger.error("[@jaypie/aws] Error fetching secret from AWS SDK");
        logger.debug({ error: sdkError });
        throw sdkError;
      }
    }
  }

  // If no secret reference but we have a value, return it directly
  return value;
}

//
//
// Export
//

export default getEnvSecret;
