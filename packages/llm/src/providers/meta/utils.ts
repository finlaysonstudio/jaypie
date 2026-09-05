import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE } from "@jaypie/kit";
import { createLogger, log as defaultLog } from "@jaypie/logger";

import { PROVIDER } from "../../constants.js";
import { OpenAIClient } from "../openai/client.js";

// Logger
export const getLogger = (): ReturnType<typeof createLogger> =>
  defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<OpenAIClient> {
  const logger = getLogger();
  let resolvedApiKey = apiKey;
  let source = "apiKey";

  // META_API_KEY sits beside XAI_API_KEY and MISTRAL_API_KEY. MODEL_API_KEY is
  // the name Meta's docs and SDK examples use, so a key configured per Meta's
  // quick start works unchanged when the preferred name is unset.
  if (!resolvedApiKey) {
    resolvedApiKey = await getEnvSecret(PROVIDER.META.API_KEY);
    source = PROVIDER.META.API_KEY;
  }
  if (!resolvedApiKey) {
    resolvedApiKey = await getEnvSecret(PROVIDER.META.API_KEY_FALLBACK);
    source = PROVIDER.META.API_KEY_FALLBACK;
  }

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const client = new OpenAIClient({
    apiKey: resolvedApiKey,
    baseURL: PROVIDER.META.BASE_URL,
  });
  logger.trace(`Initialized Meta client (key from ${source})`);
  return client;
}
