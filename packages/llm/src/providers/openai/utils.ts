import { getEnvSecret } from "@jaypie/aws";
import {
  ConfigurationError,
  log as defaultLog,
  placeholders as replacePlaceholders,
  JAYPIE,
} from "@jaypie/core";
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";
import { naturalZodSchema } from "../../util";

// Logger
export const getLogger = () => defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<OpenAI> {
  const logger = getLogger();
  const resolvedApiKey = apiKey || (await getEnvSecret("OPENAI_API_KEY"));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const client = new OpenAI({ apiKey: resolvedApiKey });
  logger.trace("Initialized OpenAI client");
  return client;
}

// Message formatting
export interface ChatMessage {
  role: "user" | "developer";
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
    role: "developer" as const,
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

// Completion requests
export async function createStructuredCompletion(
  client: OpenAI,
  {
    messages,
    responseSchema,
    model,
  }: {
    messages: ChatMessage[];
    responseSchema: z.ZodType | NaturalSchema;
    model: string;
  },
): Promise<JsonObject> {
  const logger = getLogger();
  logger.trace("Using structured output");

  const zodSchema =
    responseSchema instanceof z.ZodType
      ? responseSchema
      : naturalZodSchema(responseSchema as NaturalSchema);

  const completion = await client.beta.chat.completions.parse({
    messages,
    model,
    response_format: zodResponseFormat(zodSchema, "response"),
  });

  logger.var({ assistantReply: completion.choices[0].message.parsed });
  return completion.choices[0].message.parsed;
}

export async function createTextCompletion(
  client: OpenAI,
  {
    messages,
    model,
  }: {
    messages: ChatMessage[];
    model: string;
  },
): Promise<string> {
  const logger = getLogger();
  logger.trace("Using text output (unstructured)");

  const completion = await client.chat.completions.create({
    messages,
    model,
  });

  logger.trace(
    `Assistant reply: ${completion.choices[0]?.message?.content?.length} characters`,
  );

  return completion.choices[0]?.message?.content || "";
}
