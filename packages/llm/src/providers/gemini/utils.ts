import { getEnvSecret } from "@jaypie/aws";
import {
  ConfigurationError,
  log as defaultLog,
  placeholders as replacePlaceholders,
  JAYPIE,
} from "@jaypie/core";
import { GoogleGenAI } from "@google/genai";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";

// Logger
export const getLogger = () => defaultLog.lib({ lib: JAYPIE.LIB.LLM });

// Client initialization
export async function initializeClient({
  apiKey,
}: {
  apiKey?: string;
} = {}): Promise<GoogleGenAI> {
  const logger = getLogger();
  const resolvedApiKey = apiKey || (await getEnvSecret("GEMINI_API_KEY"));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const client = new GoogleGenAI({ apiKey: resolvedApiKey });
  logger.trace("Initialized Gemini client");
  return client;
}

// Message formatting
export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export function formatSystemMessage(
  systemPrompt: string,
  { data, placeholders }: Pick<LlmMessageOptions, "data" | "placeholders"> = {},
): string {
  const content =
    placeholders?.system === false
      ? systemPrompt
      : replacePlaceholders(systemPrompt, data);

  return content;
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
  { data, placeholders }: LlmMessageOptions = {},
): { messages: ChatMessage[]; systemInstruction?: string } {
  const logger = getLogger();
  const messages: ChatMessage[] = [];
  let systemInstruction: string | undefined;

  // Note: Gemini handles system prompts differently via systemInstruction config
  // This function is kept for compatibility but system prompts should be passed
  // via the systemInstruction parameter in generateContent

  const userMessage = formatUserMessage(message, { data, placeholders });
  messages.push(userMessage);
  logger.trace(`User message: ${userMessage.content?.length} characters`);

  return { messages, systemInstruction };
}
