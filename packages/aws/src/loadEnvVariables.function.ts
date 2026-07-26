import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE } from "@jaypie/kit";
import { log } from "@jaypie/logger";

import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import axios, { AxiosError } from "axios";

import getS3FileBuffer from "./getS3FileBuffer.function.js";

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
  warn: (message: string) => void;
}

interface EnvObject {
  [key: string]: string | undefined;
}

interface LoadEnvVariablesOptions {
  env?: EnvObject;
}

//
//
// Constants
//

const DEFAULT = {
  PARAMETERS_SECRETS_EXTENSION_HTTP_PORT: 2773,
};

const HTTP = {
  HEADER: {
    AMAZON: {
      PARAMETERS_SECRETS_TOKEN: "X-Aws-Parameters-Secrets-Token",
    },
  },
};

const POINTER = "CDK_ENV_VARIABLES";

const S3_PROTOCOL = "s3://";

const SECRET_PREFIX = "SECRET_";

const TIMEOUT = {
  REQUEST: 3000,
};

//
//
// Cache
//

// Cold-start cache. The handler lifecycle calls this on every invocation, so
// the fetch must happen once per execution context, not once per request.
let bundleCache: Promise<Record<string, unknown>> | undefined;

/**
 * Discard the cached variables bundle so the next call fetches again.
 * Exported for tests and for long-lived processes that need to re-read.
 */
export function clearEnvVariablesCache(): void {
  bundleCache = undefined;
}

//
//
// Helpers
//

function parseBundle(raw: string, pointer: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigurationError(
      `Variables bundle at "${pointer}" is not valid JSON`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigurationError(
      `Variables bundle at "${pointer}" is not an object`,
    );
  }
  return parsed as Record<string, unknown>;
}

async function fetchFromS3(pointer: string): Promise<string> {
  const location = pointer.slice(S3_PROTOCOL.length);
  const separator = location.indexOf("/");
  if (separator < 1 || separator === location.length - 1) {
    throw new ConfigurationError(
      `Variables pointer "${pointer}" is not a valid s3:// location`,
    );
  }
  const buffer = await getS3FileBuffer({
    bucket: location.slice(0, separator),
    key: location.slice(separator + 1),
  });
  return buffer.toString();
}

async function fetchFromExtension(
  pointer: string,
  env: EnvObject,
): Promise<string | undefined> {
  if (!env.AWS_SESSION_TOKEN) {
    return undefined;
  }
  const port =
    env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ||
    DEFAULT.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT;
  const response = await axios.get(
    `http://localhost:${port}/systemsmanager/parameters/get`,
    {
      headers: {
        [HTTP.HEADER.AMAZON.PARAMETERS_SECRETS_TOKEN]: env.AWS_SESSION_TOKEN,
      },
      params: { name: pointer },
      timeout: TIMEOUT.REQUEST,
    },
  );
  return response?.data?.Parameter?.Value;
}

async function fetchFromSsm(pointer: string): Promise<string | undefined> {
  const client = new SSMClient();
  const response = await client.send(
    new GetParameterCommand({ Name: pointer }),
  );
  return response.Parameter?.Value;
}

async function fetchBundle(
  pointer: string,
  env: EnvObject,
): Promise<Record<string, unknown>> {
  const logger = log.lib({ lib: JAYPIE.LIB.AWS }) as unknown as JaypieLogger;

  if (pointer.startsWith(S3_PROTOCOL)) {
    return parseBundle(await fetchFromS3(pointer), pointer);
  }

  // Prefer the Parameters and Secrets extension; it caches across invocations
  try {
    const extensionValue = await fetchFromExtension(pointer, env);
    if (extensionValue) {
      return parseBundle(extensionValue, pointer);
    }
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.debug(
      "[@jaypie/aws] Parameters extension failed, falling back to AWS SDK",
    );
    logger.debug({
      error: { code: axiosError.code, message: axiosError.message },
    });
  }

  const value = await fetchFromSsm(pointer);
  if (!value) {
    throw new ConfigurationError(
      `Variables bundle "${pointer}" could not be resolved`,
    );
  }
  return parseBundle(value, pointer);
}

//
//
// Main
//

/**
 * Hydrate non-secret configuration into `process.env` from the bundle written
 * at deploy time by the `variables` prop on `JaypieLambda`.
 *
 * No-op unless `CDK_ENV_VARIABLES` is present. Real environment variables win:
 * the bundle only fills keys that are absent, so an inline value always beats
 * the bundle. Fetched once per execution context and idempotent thereafter.
 *
 * Secrets never belong in the bundle. Keys prefixed `SECRET_` are refused so a
 * misconfigured deploy cannot route credentials through this path.
 *
 * @returns `true` when a bundle was applied, otherwise `false`
 * @throws {ConfigurationError} if the pointer is set but cannot be resolved
 */
async function loadEnvVariables({
  env = process.env,
}: LoadEnvVariablesOptions = {}): Promise<boolean> {
  const logger = log.lib({ lib: JAYPIE.LIB.AWS }) as unknown as JaypieLogger;

  const pointer = env[POINTER];
  if (!pointer) {
    return false;
  }

  logger.trace.var({ loadEnvVariables: pointer });

  if (!bundleCache) {
    bundleCache = fetchBundle(pointer, env);
  }

  let bundle: Record<string, unknown>;
  try {
    bundle = await bundleCache;
  } catch (error) {
    // Allow a later invocation to retry a transient failure
    bundleCache = undefined;
    throw error;
  }

  const loaded: string[] = [];
  for (const [key, value] of Object.entries(bundle)) {
    if (key.startsWith(SECRET_PREFIX)) {
      logger.warn(
        `[@jaypie/aws] Ignoring "${key}" from variables bundle; secrets must use the secrets option`,
      );
      continue;
    }
    if (env[key] !== undefined) {
      continue;
    }
    env[key] = String(value);
    loaded.push(key);
  }

  if (loaded.length > 0) {
    logger.var({ loadedVariables: loaded });
  }

  return true;
}

//
//
// Export
//

export default loadEnvVariables;
