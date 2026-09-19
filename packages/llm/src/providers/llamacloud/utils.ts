import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE } from "@jaypie/kit";
import { createLogger, log as defaultLog } from "@jaypie/logger";

import { MODEL, PROVIDER } from "../../constants.js";
import { LlamaCloudClient, LlamaCloudParseTier } from "./client.js";

//
//
// Constants
//

const TIER_PREFIX = "llamaparse-";

/** Catalog id → API tier. The id is the tier with a prefix and dashes. */
const TIER_BY_MODEL: Record<string, LlamaCloudParseTier> = {
  [MODEL.LLAMAPARSE.AGENTIC]: "agentic",
  [MODEL.LLAMAPARSE.AGENTIC_PLUS]: "agentic_plus",
  [MODEL.LLAMAPARSE.COST_EFFECTIVE]: "cost_effective",
  [MODEL.LLAMAPARSE.FAST]: "fast",
};

//
//
// Main
//

// Logger
export const getLogger = (): ReturnType<typeof createLogger> =>
  defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<LlamaCloudClient> {
  const logger = getLogger();
  const resolvedApiKey =
    apiKey || (await getEnvSecret(PROVIDER.LLAMACLOUD.API_KEY));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const client = new LlamaCloudClient({ apiKey: resolvedApiKey });
  logger.trace("Initialized LlamaCloud client");
  return client;
}

/**
 * Map a catalog id to the API tier. Accepts the four `MODEL.LLAMAPARSE.*`
 * ids and any `llamaparse-<tier>` spelling; anything else is a
 * configuration error rather than a silent default, since the tier sets the
 * price by an order of magnitude.
 */
export function resolveTier(model: string): LlamaCloudParseTier {
  const known = TIER_BY_MODEL[model];
  if (known) {
    return known;
  }
  const lower = model.toLowerCase();
  if (lower.startsWith(TIER_PREFIX)) {
    const candidate = lower.slice(TIER_PREFIX.length).replace(/-/g, "_");
    const match = Object.values(TIER_BY_MODEL).find(
      (tier) => tier === candidate,
    );
    if (match) {
      return match;
    }
  }
  throw new ConfigurationError(
    `Unknown LlamaParse tier "${model}"; expected one of ${Object.keys(TIER_BY_MODEL).join(", ")}`,
  );
}
