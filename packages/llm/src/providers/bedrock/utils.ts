import { JAYPIE } from "@jaypie/kit";
import { createLogger, log as defaultLog } from "@jaypie/logger";
import { ConfigurationError } from "@jaypie/errors";
import type { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

let cachedSdk: typeof import("@aws-sdk/client-bedrock-runtime") | null = null;

export async function loadSdk(): Promise<
  typeof import("@aws-sdk/client-bedrock-runtime")
> {
  if (cachedSdk) return cachedSdk;
  try {
    cachedSdk = await import("@aws-sdk/client-bedrock-runtime");
    return cachedSdk;
  } catch {
    throw new ConfigurationError(
      "@aws-sdk/client-bedrock-runtime is required but not installed. Run: npm install @aws-sdk/client-bedrock-runtime",
    );
  }
}

export const getLogger = (): ReturnType<typeof createLogger> =>
  defaultLog.lib({ lib: JAYPIE.LIB.LLM });

export async function initializeClient({
  region,
}: { region?: string } = {}): Promise<BedrockRuntimeClient> {
  const logger = getLogger();
  const resolvedRegion = region || process.env.AWS_REGION || "us-east-1";

  const sdk = await loadSdk();
  const client = new sdk.BedrockRuntimeClient({ region: resolvedRegion });
  logger.trace("Initialized Bedrock client");
  return client;
}
