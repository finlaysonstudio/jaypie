import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE } from "@jaypie/kit";
import { log as defaultLog } from "@jaypie/logger";
import { OpenAI } from "openai";

import { PROVIDER } from "../../constants.js";

// Logger
export const getLogger = () => defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<OpenAI> {
  const logger = getLogger();
  const resolvedApiKey = apiKey || (await getEnvSecret(PROVIDER.XAI.API_KEY));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const client = new OpenAI({
    apiKey: resolvedApiKey,
    baseURL: PROVIDER.XAI.BASE_URL,
  });
  logger.trace("Initialized xAI client");
  return client;
}
