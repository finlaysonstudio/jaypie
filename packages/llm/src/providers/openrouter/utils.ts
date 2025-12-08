import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE, placeholders as replacePlaceholders } from "@jaypie/kit";
import { log as defaultLog } from "@jaypie/logger";
import type { OpenRouter } from "@openrouter/sdk";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";
import { PROVIDER } from "../../constants.js";

// SDK loader with caching
let cachedSdk: typeof import("@openrouter/sdk") | null = null;

export async function loadSdk(): Promise<typeof import("@openrouter/sdk")> {
  if (cachedSdk) return cachedSdk;
  try {
    cachedSdk = await import("@openrouter/sdk");
    return cachedSdk;
  } catch {
    throw new ConfigurationError(
      "@openrouter/sdk is required but not installed. Run: npm install @openrouter/sdk",
    );
  }
}

// Logger
export const getLogger = () => defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<OpenRouter> {
  const logger = getLogger();
  const resolvedApiKey = apiKey || (await getEnvSecret("OPENROUTER_API_KEY"));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const sdk = await loadSdk();
  const client = new sdk.OpenRouter({ apiKey: resolvedApiKey });
  logger.trace("Initialized OpenRouter client");
  return client;
}

// Get default model from environment or constants
export function getDefaultModel(): string {
  return process.env.OPENROUTER_MODEL || PROVIDER.OPENROUTER.MODEL.DEFAULT;
}

// Message formatting
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function formatSystemMessage(
  systemPrompt: string,
  { data, placeholders }: Pick<LlmMessageOptions, "data" | "placeholders"> = {},
): ChatMessage {
  const content =
    placeholders?.system === false
      ? systemPrompt
      : replacePlaceholders(systemPrompt, data);

  return {
    role: "system" as const,
    content,
  };
}

export function formatUserMessage(
  message: string,
  { data, placeholders }: Pick<LlmMessageOptions, "data" | "placeholders"> = {},
): ChatMessage {
  const content =
    placeholders?.message === false
      ? message
      : replacePlaceholders(message, data);

  return {
    role: "user" as const,
    content,
  };
}

export function prepareMessages(
  message: string,
  { system, data, placeholders }: LlmMessageOptions = {},
): ChatMessage[] {
  const logger = getLogger();
  const messages: ChatMessage[] = [];

  if (system) {
    const systemMessage = formatSystemMessage(system, { data, placeholders });
    messages.push(systemMessage);
    logger.trace(`System message: ${systemMessage.content?.length} characters`);
  }

  const userMessage = formatUserMessage(message, { data, placeholders });
  messages.push(userMessage);
  logger.trace(`User message: ${userMessage.content?.length} characters`);

  return messages;
}
