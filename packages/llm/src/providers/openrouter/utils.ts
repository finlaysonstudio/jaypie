import { getEnvSecret } from "@jaypie/aws";
import {
  ConfigurationError,
  log as defaultLog,
  placeholders as replacePlaceholders,
  JAYPIE,
  log,
} from "@jaypie/core";
import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import {
  CoreAssistantMessage,
  CoreSystemMessage,
  CoreToolMessage,
  CoreUserMessage,
  generateObject,
  generateText,
} from "ai";
import { PROVIDER } from "../../constants.js";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";
import { naturalZodSchema } from "../../util/index.js";
import { z } from "zod";
import { JsonObject, NaturalSchema } from "@jaypie/types";

// Logger
export const getLogger = () => defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<OpenRouterProvider> {
  const logger = getLogger();
  const resolvedApiKey = apiKey || (await getEnvSecret("OPENROUTER_API_KEY"));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the required API key: OPENROUTER_API_KEY",
    );
  }

  const client = createOpenRouter({ apiKey: resolvedApiKey });
  logger.trace("Initialized OpenRouter client");
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
): CoreUserMessage {
  const content =
    placeholders?.message === false
      ? message
      : replacePlaceholders(message, data);

  return {
    role: PROVIDER.OPENROUTER.ROLE.USER,
    content,
  };
}

export function prepareMessages(
  message: string,
  { data, placeholders }: LlmMessageOptions = {},
): CoreUserMessage[] {
  const logger = getLogger();
  const messages: CoreUserMessage[] = [];

  // Add user message (necessary for all requests)
  const userMessage = formatUserMessage(message, { data, placeholders });
  messages.push(userMessage);
  logger.trace(`User message: ${userMessage.content.length} characters`);

  return messages;
}

// Basic text completion
export async function createTextCompletion(
  client: OpenRouterProvider,
  messages: (
    | CoreSystemMessage
    | CoreUserMessage
    | CoreAssistantMessage
    | CoreToolMessage
  )[],
  model: string,
  systemMessage?: string,
): Promise<string> {
  log.trace("Using text output (unstructured)");

  // Add system instruction if provided
  if (systemMessage) {
    log.trace(`System message: ${systemMessage.length} characters`);
  }

  const response = await generateText({
    model: client(model),
    messages,
    system: systemMessage,
    maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
  });

  log.trace(`Assistant reply: ${response.text.length} characters`);

  return response.text;
}

// Structured output completion
export async function createStructuredCompletion(
  client: OpenRouterProvider,
  messages: (
    | CoreSystemMessage
    | CoreUserMessage
    | CoreAssistantMessage
    | CoreToolMessage
  )[],
  model: string,
  responseSchema: z.ZodType | NaturalSchema,
  systemMessage?: string,
): Promise<JsonObject> {
  log.trace("Using structured output");

  // Get the JSON schema for the response
  const schema =
    responseSchema instanceof z.ZodType
      ? responseSchema
      : naturalZodSchema(responseSchema as NaturalSchema);

  const response = await generateObject({
    model: client(model),
    messages,
    schema,
    system: systemMessage,
    maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
  });

  return response.object;
}
