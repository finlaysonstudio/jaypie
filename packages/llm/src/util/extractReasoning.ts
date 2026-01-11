import { LlmHistory } from "../types/LlmProvider.interface.js";

/**
 * Represents a reasoning item with optional summary array (OpenAI format).
 * This type is used internally for type-safe access to reasoning-specific properties.
 */
interface ReasoningItem {
  content?: string;
  id?: string;
  summary?: Array<{ text?: string }>;
  type: "reasoning";
}

/**
 * Represents a thinking item (Anthropic format).
 * Anthropic extended thinking uses `thinking` blocks with type "thinking".
 */
interface ThinkingItem {
  thinking?: string;
  type: "thinking";
}

/**
 * Represents a message item that may contain a reasoning property.
 * Used by some providers like OpenRouter/z-ai that include reasoning as a message property.
 */
interface MessageWithReasoning {
  reasoning?: string;
  role?: string;
  type?: string;
}

/**
 * Type guard to check if an item is a dedicated reasoning item (OpenAI)
 */
function isReasoningItem(item: unknown): item is ReasoningItem {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as { type?: string }).type === "reasoning"
  );
}

/**
 * Type guard to check if an item is a thinking item (Anthropic)
 */
function isThinkingItem(item: unknown): item is ThinkingItem {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as { type?: string }).type === "thinking" &&
    typeof (item as ThinkingItem).thinking === "string"
  );
}

/**
 * Type guard to check if an item has a reasoning property
 */
function hasReasoningProperty(item: unknown): item is MessageWithReasoning {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as MessageWithReasoning).reasoning === "string" &&
    (item as MessageWithReasoning).reasoning !== ""
  );
}

/**
 * Extracts reasoning text from LLM history items.
 *
 * Reasoning items may have text in different locations depending on the provider:
 * - OpenAI: `summary` array with objects containing `text` property (type: "reasoning")
 * - OpenAI: `content` property on reasoning items (type: "reasoning")
 * - Anthropic: `thinking` property on thinking items (type: "thinking")
 * - OpenRouter/z-ai: `reasoning` property on message items
 *
 * @param history - The LLM history array to extract reasoning from
 * @returns Array of reasoning text strings
 */
export function extractReasoning(history: LlmHistory): string[] {
  const reasoningTexts: string[] = [];

  for (const item of history) {
    // Cast to unknown first for type checking
    const entry = item as unknown;

    // Handle dedicated reasoning items (OpenAI extended thinking)
    if (isReasoningItem(entry)) {
      // Handle summary array format
      if (Array.isArray(entry.summary)) {
        for (const summaryItem of entry.summary) {
          if (summaryItem?.text && typeof summaryItem.text === "string") {
            reasoningTexts.push(summaryItem.text);
          }
        }
      }

      // Handle direct content format
      if (entry.content && typeof entry.content === "string") {
        reasoningTexts.push(entry.content);
      }
    }

    // Handle thinking items (Anthropic extended thinking)
    if (isThinkingItem(entry)) {
      reasoningTexts.push(entry.thinking!);
    }

    // Handle reasoning property on message items (OpenRouter/z-ai format)
    if (hasReasoningProperty(entry)) {
      reasoningTexts.push(entry.reasoning!);
    }
  }

  return reasoningTexts;
}
