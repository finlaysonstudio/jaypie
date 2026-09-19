import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE } from "@jaypie/kit";
import { createLogger, log as defaultLog } from "@jaypie/logger";

import { PROVIDER } from "../../constants.js";
import { TypeSafeClient } from "./client.js";

// Logger
export const getLogger = (): ReturnType<typeof createLogger> =>
  defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<TypeSafeClient> {
  const logger = getLogger();
  const resolvedApiKey =
    apiKey || (await getEnvSecret(PROVIDER.TYPESAFE.API_KEY));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const client = new TypeSafeClient({ apiKey: resolvedApiKey });
  logger.trace("Initialized TypeSafe client");
  return client;
}
