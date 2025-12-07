import { getEnvSecret } from "@jaypie/aws";
import {
  ConfigurationError,
  log as defaultLog,
  placeholders as replacePlaceholders,
  JAYPIE,
  log,
} from "@jaypie/core";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER } from "../../constants.js";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";
import { naturalZodSchema } from "../../util/index.js";
import { z } from "zod/v4";
import { JsonObject, NaturalSchema } from "@jaypie/types";

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

// Basic text completion
export async function createTextCompletion(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  model: string,
  systemMessage?: string,
): Promise<string> {
  log.trace("Using text output (unstructured)");

  const params: Anthropic.MessageCreateParams = {
    model,
    messages,
    max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
  };

  // Add system instruction if provided
  if (systemMessage) {
    params.system = systemMessage;
    log.trace(`System message: ${systemMessage.length} characters`);
  }

  const response = await client.messages.create(params);

  const firstContent = response.content[0];
  const text = firstContent && "text" in firstContent ? firstContent.text : "";

  log.trace(`Assistant reply: ${text.length} characters`);

  return text;
}

// Structured output completion
export async function createStructuredCompletion(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
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

  // Set system message with JSON instructions
  const defaultSystemPrompt =
    "You will be responding with structured JSON data. " +
    "Format your entire response as a valid JSON object with the following structure: " +
    JSON.stringify(z.toJSONSchema(schema));

  const systemPrompt = systemMessage || defaultSystemPrompt;

  try {
    // Use standard Anthropic API to get response
    const params: Anthropic.MessageCreateParams = {
      model,
      messages,
      max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
      system: systemPrompt,
    };

    const response = await client.messages.create(params);

    // Extract text from response
    const firstContent = response.content[0];
    const responseText =
      firstContent && "text" in firstContent ? firstContent.text : "";

    // Find JSON in response
    const jsonMatch =
      responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
      responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        // Parse the JSON response
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const result = JSON.parse(jsonStr);
        if (!schema.parse(result)) {
          throw new Error(
            `JSON response from Anthropic does not match schema: ${responseText}`,
          );
        }
        log.trace("Received structured response", { result });
        return result;
      } catch {
        throw new Error(
          `Failed to parse JSON response from Anthropic: ${responseText}`,
        );
      }
    }

    // If we can't extract JSON
    throw new Error("Failed to parse structured response from Anthropic");
  } catch (error: unknown) {
    log.error("Error creating structured completion", { error });
    throw error;
  }
}
