import { getEnvSecret } from "@jaypie/aws";
import {
  ConfigurationError,
  log as defaultLog,
  placeholders as replacePlaceholders,
  JAYPIE,
} from "@jaypie/core";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER } from "../../constants.js";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";

// Logger
export const getLogger = () => defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<Anthropic> {
  const logger = getLogger();
  const resolvedApiKey = apiKey || (await getEnvSecret("ANTHROPIC_API_KEY"));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the required API key: ANTHROPIC_API_KEY",
    );
  }

  const client = new Anthropic({ apiKey: resolvedApiKey });
  logger.trace("Initialized Anthropic client");
  return client;
}

// Message formatting functions
export function formatSystemMessage(
  systemPrompt: string,
  { data, placeholders }: Pick<LlmMessageOptions, "data" | "placeholders"> = {},
): string {
  return placeholders?.system === false
    ? systemPrompt
    : replacePlaceholders(systemPrompt, data);
}

export function formatUserMessage(
  message: string,
  { data, placeholders }: Pick<LlmMessageOptions, "data" | "placeholders"> = {},
): Anthropic.MessageParam {
  const content =
    placeholders?.message === false
      ? message
      : replacePlaceholders(message, data);

  return {
    role: PROVIDER.ANTHROPIC.ROLE.USER,
    content,
  };
}

export function prepareMessages(
  message: string,
  { data, placeholders }: LlmMessageOptions = {},
): Anthropic.MessageParam[] {
  const logger = getLogger();
  const messages: Anthropic.MessageParam[] = [];

  // Add user message (necessary for all requests)
  const userMessage = formatUserMessage(message, { data, placeholders });
  messages.push(userMessage);
  logger.trace(`User message: ${userMessage.content.length} characters`);

  return messages;
}
