import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE, placeholders as replacePlaceholders } from "@jaypie/kit";
import { log as defaultLog } from "@jaypie/logger";
import type { GoogleGenAI } from "@google/genai";
import { LlmMessageOptions } from "../../types/LlmProvider.interface.js";

// SDK loader with caching
let cachedSdk: typeof import("@google/genai") | null = null;

export async function loadSdk(): Promise<typeof import("@google/genai")> {
  if (cachedSdk) return cachedSdk;
  try {
    cachedSdk = await import("@google/genai");
    return cachedSdk;
  } catch {
    throw new ConfigurationError(
      "@google/genai is required but not installed. Run: npm install @google/genai",
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
} = {}): Promise<GoogleGenAI> {
  const logger = getLogger();
  const resolvedApiKey = apiKey || (await getEnvSecret("GEMINI_API_KEY"));

  if (!resolvedApiKey) {
    throw new ConfigurationError(
      "The application could not resolve the requested keys",
    );
  }

  const sdk = await loadSdk();
  const client = new sdk.GoogleGenAI({ apiKey: resolvedApiKey });
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
