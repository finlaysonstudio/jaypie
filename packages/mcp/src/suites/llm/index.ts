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

// Input type for the unified LLM service
interface LlmInput {
  message?: string;
  model?: string;
  provider?: LlmProvider;
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
    input: {
      description: "Command parameters",
      required: false,
      type: Object,
    },
  },
  service: async ({
    command,
    input: params,
  }: {
    command?: string;
    input?: LlmInput;
  }) => {
    if (!command || command === "help") {
      return getHelp();
    }

    const p = params || {};

    switch (command) {
      case "debug_call": {
        if (!p.provider) throw new Error("provider is required");
        if (!p.message) throw new Error("message is required");
        const result = await debugLlmCall(
          {
            message: p.message,
            model: p.model,
            provider: p.provider,
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
