import { getEnvSecret } from "@jaypie/aws";
import { log } from "@jaypie/core";
import Anthropic from "@anthropic-ai/sdk";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PROVIDER } from "../../../constants.js";
import {
  formatSystemMessage,
  formatUserMessage,
  getLogger,
  initializeClient,
  prepareMessages,
} from "../utils.js";

vi.mock("@jaypie/aws", () => ({
  getEnvSecret: vi.fn(),
}));

vi.mock("@jaypie/core", () => {
  const mockLogger = {
    trace: vi.fn(),
    error: vi.fn(),
    var: vi.fn(),
  };

  return {
    log: {
      lib: vi.fn().mockReturnValue(mockLogger),
    },
    ConfigurationError: class ConfigurationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "ConfigurationError";
      }
    },
    placeholders: vi.fn((text, data) => {
      if (!data) return text;
      return Object.entries(data).reduce((result, [key, value]) => {
        return result.replace(new RegExp(`{{${key}}}`, "g"), String(value));
      }, text);
    }),
    JAYPIE: {
      LIB: {
        LLM: "llm",
      },
    },
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

describe("Anthropic Utils", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getEnvSecret).mockResolvedValue("test-api-key");
  });

  describe("Base Cases", () => {
    it("exports getLogger", () => {
      expect(getLogger).toBeFunction();
    });

    it("exports initializeClient", () => {
      expect(initializeClient).toBeFunction();
    });

    it("exports formatSystemMessage", () => {
      expect(formatSystemMessage).toBeFunction();
    });

    it("exports formatUserMessage", () => {
      expect(formatUserMessage).toBeFunction();
    });

    it("exports prepareMessages", () => {
      expect(prepareMessages).toBeFunction();
    });
  });

  describe("Error Conditions", () => {
    it("throws ConfigurationError when API key is not available", async () => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
      await expect(initializeClient()).rejects.toThrow(
        "The application could not resolve the required API key",
      );
    });
  });

  describe("Happy Paths", () => {
    describe("initializeClient", () => {
      it("initializes client with provided API key", async () => {
        // Setup explicit mock for logger
        const mockLogger = {
          trace: vi.fn(),
          error: vi.fn(),
          var: vi.fn(),
        } as any;
        vi.mocked(log.lib).mockReturnValue(mockLogger);

        await initializeClient({ apiKey: "provided-key" });
        expect(Anthropic).toHaveBeenCalledWith({ apiKey: "provided-key" });
        expect(mockLogger.trace).toHaveBeenCalledWith(
          "Initialized Anthropic client",
        );
      });

      it("initializes client with environment API key", async () => {
        // Setup explicit mock for logger
        const mockLogger = {
          trace: vi.fn(),
          error: vi.fn(),
          var: vi.fn(),
        } as any;
        vi.mocked(log.lib).mockReturnValue(mockLogger);

        await initializeClient();
        expect(Anthropic).toHaveBeenCalledWith({ apiKey: "test-api-key" });
        expect(mockLogger.trace).toHaveBeenCalledWith(
          "Initialized Anthropic client",
        );
      });
    });

    describe("formatSystemMessage", () => {
      it("returns system message as is when placeholders.system is false", () => {
        const result = formatSystemMessage("You are a {{role}}", {
          data: { role: "test assistant" },
          placeholders: { system: false },
        });
        expect(result).toBe("You are a {{role}}");
      });

      it("replaces placeholders in system message", () => {
        const result = formatSystemMessage("You are a {{role}}", {
          data: { role: "test assistant" },
        });
        expect(result).toBe("You are a test assistant");
      });
    });

    describe("formatUserMessage", () => {
      it("returns user message with proper role", () => {
        const result = formatUserMessage("Hello");
        expect(result).toEqual({
          role: PROVIDER.ANTHROPIC.ROLE.USER,
          content: "Hello",
        });
      });

      it("returns user message with placeholders replaced", () => {
        const result = formatUserMessage("Hello, {{name}}", {
          data: { name: "World" },
        });
        expect(result).toEqual({
          role: PROVIDER.ANTHROPIC.ROLE.USER,
          content: "Hello, World",
        });
      });

      it("keeps placeholders intact when placeholders.message is false", () => {
        const result = formatUserMessage("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { message: false },
        });
        expect(result).toEqual({
          role: PROVIDER.ANTHROPIC.ROLE.USER,
          content: "Hello, {{name}}",
        });
      });
    });

    describe("prepareMessages", () => {
      beforeEach(() => {
        vi.mocked(log.lib).mockReturnValue({
          trace: vi.fn(),
          error: vi.fn(),
          var: vi.fn(),
        } as any);
      });

      it("prepares user message", () => {
        const messages = prepareMessages("Hello");
        expect(messages).toEqual([
          {
            role: PROVIDER.ANTHROPIC.ROLE.USER,
            content: "Hello",
          },
        ]);
      });

      it("prepares user message with placeholder replacements", () => {
        const messages = prepareMessages("Hello, {{name}}", {
          data: { name: "World" },
        });
        expect(messages).toEqual([
          {
            role: PROVIDER.ANTHROPIC.ROLE.USER,
            content: "Hello, World",
          },
        ]);
      });

      it("respects placeholders.message option", () => {
        const messages = prepareMessages("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { message: false },
        });
        expect(messages).toEqual([
          {
            role: PROVIDER.ANTHROPIC.ROLE.USER,
            content: "Hello, {{name}}",
          },
        ]);
      });
    });
  });
});
