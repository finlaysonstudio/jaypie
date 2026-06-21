import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE, placeholders as replacePlaceholders } from "@jaypie/kit";
import { createLogger, log as defaultLog, log } from "@jaypie/logger";
import type Anthropic from "@anthropic-ai/sdk";
import { PROVIDER } from "../../constants.js";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";
import { naturalZodSchema } from "../../util/index.js";
import { z } from "zod/v4";
import { JsonObject, NaturalSchema } from "@jaypie/types";

// SDK loader with caching
let cachedSdk: typeof import("@anthropic-ai/sdk") | null = null;

export async function loadSdk(): Promise<typeof import("@anthropic-ai/sdk")> {
  if (cachedSdk) return cachedSdk;
  try {
    cachedSdk = await import("@anthropic-ai/sdk");
    return cachedSdk;
  } catch {
    throw new ConfigurationError(
      "@anthropic-ai/sdk is required but not installed. Run: npm install @anthropic-ai/sdk",
    );
  }
}

// Logger
export const getLogger = (): ReturnType<typeof createLogger> =>
  defaultLog.lib({ lib: JAYPIE.LIB.LLM });

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

  const sdk = await loadSdk();
  const client = new sdk.default({ apiKey: resolvedApiKey });
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

// Structured output completion using Anthropic's native `output_config.format`
// field. Returns a JsonObject parsed and validated against the caller's
// Zod schema.
export async function createStructuredCompletion(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  model: string,
  responseSchema: z.ZodType | NaturalSchema,
  systemMessage?: string,
): Promise<JsonObject> {
  log.trace("Using native structured output");

  const schema =
    responseSchema instanceof z.ZodType
      ? responseSchema
      : naturalZodSchema(responseSchema as NaturalSchema);

  // Type extension: SDK 0.71 doesn't type `output_config` on
  // `MessageCreateParams`. The GA endpoint accepts the field; the older
  // `output_format` field is now deprecated.
  type StructuredOutputParams = Anthropic.MessageCreateParams & {
    output_config?: {
      format: {
        type: "json_schema";
        schema: JsonObject;
      };
    };
  };

  const jsonSchema = z.toJSONSchema(schema) as JsonObject;
  const params: StructuredOutputParams = {
    model,
    messages,
    max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
    output_config: {
      format: { type: "json_schema", schema: jsonSchema },
    },
  };
  if (systemMessage) {
    params.system = systemMessage;
  }

  const response = (await client.messages.create(
    params as Anthropic.MessageCreateParams,
  )) as Anthropic.Message;

  if (response.stop_reason === "refusal") {
    throw new Error(
      "Anthropic refused the structured-output request (stop_reason=refusal)",
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Anthropic structured-output response was truncated (stop_reason=max_tokens); increase max_tokens",
    );
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  if (!textBlock) {
    throw new Error("Failed to parse structured response from Anthropic");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error(
      "Failed to parse structured response from Anthropic: " + textBlock.text,
    );
  }

  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `JSON response from Anthropic does not match schema: ${textBlock.text}`,
    );
  }
  log.trace("Received structured response", { result: validation.data });
  return validation.data as JsonObject;
}
