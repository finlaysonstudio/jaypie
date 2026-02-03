/**
 * LLM Suite - Unified LLM debugging and inspection
 */
import { fabricService } from "@jaypie/fabric";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { debugLlmCall, type LlmProvider } from "./llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Silent logger for direct execution
const log = {
  error: () => {},
  info: () => {},
};

async function getHelp(): Promise<string> {
  return fs.readFile(path.join(__dirname, "help.md"), "utf-8");
}

// Flattened input type for the unified LLM service
interface LlmInput {
  command?: string;
  message?: string;
  model?: string;
  provider?: string;
}

export const llmService = fabricService({
  alias: "llm",
  description:
    "Debug LLM provider responses. Commands: debug_call. Call with no args for help.",
  input: {
    command: {
      description: "Command to execute (omit for help)",
      required: false,
      type: String,
    },
    message: {
      description: "Message to send to the LLM provider",
      required: false,
      type: String,
    },
    model: {
      description:
        "Model to use (provider-specific, e.g., gpt-4, claude-3-sonnet)",
      required: false,
      type: String,
    },
    provider: {
      description: "LLM provider: anthropic, openai, google, openrouter",
      required: false,
      type: String,
    },
  },
  service: async (params: LlmInput) => {
    const { command } = params;

    if (!command || command === "help") {
      return getHelp();
    }

    const p = params;

    switch (command) {
      case "debug_call": {
        if (!p.provider) throw new Error("provider is required");
        if (!p.message) throw new Error("message is required");
        const result = await debugLlmCall(
          {
            message: p.message,
            model: p.model,
            provider: p.provider as LlmProvider,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result;
      }

      default:
        throw new Error(`Unknown command: ${command}. Use llm() for help.`);
    }
  },
});

// Re-export types and functions for testing
export * from "./llm.js";
