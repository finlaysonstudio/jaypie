import { getEnvSecret } from "@jaypie/aws";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FireworksProvider } from "../FireworksProvider.class";
import { FireworksClient } from "../client.js";
import { PROVIDER } from "../../../constants.js";

// Mock the Fireworks client
vi.mock("../client.js");

// Mock the OperateLoop for conversation history tests
vi.mock("../../../operate/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createOperateLoop: vi.fn(() => ({
      execute: vi.fn(),
    })),
  };
});

vi.mock("@jaypie/aws", async () => {
  const actual = await vi.importActual("@jaypie/aws");
  const module = {
    ...actual,
    getEnvSecret: vi.fn(() => "MOCK_VALUE"),
  };
  return module;
});

describe("FireworksProvider", () => {
  beforeEach(() => {
    vi.mocked(FireworksClient).mockImplementation(
      class {
        chatCompletion = vi.fn();
      } as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-fireworks-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(FireworksProvider).toBeFunction();
    });

    it("Works", () => {
      const provider = new FireworksProvider();
      expect(provider).toBeInstanceOf(FireworksProvider);
    });

    it("defaults to Fireworks default model", () => {
      const provider = new FireworksProvider();
      expect(provider["model"]).toBe(PROVIDER.FIREWORKS.DEFAULT);
    });

    it("accepts a custom model", () => {
      const provider = new FireworksProvider(
        "accounts/fireworks/models/kimi-k2p7-code",
      );
      expect(provider["model"]).toBe(
        "accounts/fireworks/models/kimi-k2p7-code",
      );
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new FireworksProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-fireworks-key");
    });

    it("sends messages using the Fireworks client", async () => {
      const mockResponse = {
        choices: [{ message: { content: "test response from fireworks" } }],
      };

      const mockChatCompletion = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(FireworksClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new FireworksProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response from fireworks");
      expect(mockChatCompletion).toHaveBeenCalledWith({
        model: PROVIDER.FIREWORKS.DEFAULT,
        messages: [{ role: "user", content: "test message" }],
      });
    });

    it("initializes the Fireworks client with the resolved API key", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "response" } }],
      });
      vi.mocked(FireworksClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new FireworksProvider();
      await provider.send("test");

      expect(FireworksClient).toHaveBeenCalledWith({
        apiKey: "test-fireworks-key",
      });
    });

    it("resolves FIREWORKS_API_KEY from environment", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "response" } }],
      });
      vi.mocked(FireworksClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new FireworksProvider();
      await provider.send("test");

      expect(getEnvSecret).toHaveBeenCalledWith(PROVIDER.FIREWORKS.API_KEY);
    });

    it("includes a system message when provided", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "response" } }],
      });
      vi.mocked(FireworksClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new FireworksProvider();
      await provider.send("test", { system: "Be helpful" });

      expect(mockChatCompletion).toHaveBeenCalledWith({
        model: PROVIDER.FIREWORKS.DEFAULT,
        messages: [
          { role: "system", content: "Be helpful" },
          { role: "user", content: "test" },
        ],
      });
    });

    it("parses JSON content when structured response is requested", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"capital":"Paris"}' } }],
      });
      vi.mocked(FireworksClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new FireworksProvider();
      const response = await provider.send("test", {
        response: { capital: String },
      });

      expect(response).toEqual({ capital: "Paris" });
    });

    it("delegates operate to the operate loop", async () => {
      const { createOperateLoop } = await import("../../../operate/index.js");
      const mockExecute = vi.fn().mockResolvedValue({
        content: "loop response",
        history: [],
      });
      vi.mocked(createOperateLoop).mockReturnValue({
        execute: mockExecute,
      } as any);

      const provider = new FireworksProvider();
      const response = await provider.operate("test input");

      expect(mockExecute).toHaveBeenCalledWith("test input", {
        model: PROVIDER.FIREWORKS.DEFAULT,
      });
      expect(response.content).toBe("loop response");
    });
  });
});
