import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE, placeholders as replacePlaceholders } from "@jaypie/kit";
import { createLogger, log as defaultLog } from "@jaypie/logger";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";
import { PROVIDER } from "../../constants.js";
import { FireworksClient } from "./client.js";

// Logger
export const getLogger = (): ReturnType<typeof createLogger> =>
  defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<FireworksClient> {
  const logger = getLogger();
  const resolvedApiKey =
    apiKey || (await getEnvSecret(PROVIDER.FIREWORKS.API_KEY));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const client = new FireworksClient({ apiKey: resolvedApiKey });
  logger.trace("Initialized Fireworks client");
  return client;
}

// Get default model from environment or constants
export function getDefaultModel(): string {
  return process.env.FIREWORKS_MODEL || PROVIDER.FIREWORKS.DEFAULT;
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
