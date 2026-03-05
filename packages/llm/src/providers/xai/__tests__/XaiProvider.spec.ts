import { getEnvSecret } from "@jaypie/aws";
import { OpenAI } from "openai";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { XaiProvider } from "../XaiProvider.class";
import { PROVIDER } from "../../../constants.js";

// Mock the operate module
vi.mock("openai");

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

describe("XaiProvider", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: vi.fn(),
              parse: vi.fn(),
            },
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-xai-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(XaiProvider).toBeFunction();
    });

    it("Works", () => {
      const provider = new XaiProvider();
      expect(provider).toBeInstanceOf(XaiProvider);
    });

    it("defaults to xAI default model", () => {
      const provider = new XaiProvider();
      expect(provider["model"]).toBe(PROVIDER.XAI.MODEL.DEFAULT);
    });

    it("accepts a custom model", () => {
      const provider = new XaiProvider("grok-3");
      expect(provider["model"]).toBe("grok-3");
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new XaiProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-xai-key");
    });

    it("sends messages using OpenAI SDK with xAI base URL", async () => {
      const mockResponse = {
        choices: [{ message: { content: "test response from grok" } }],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            chat: {
              completions: {
                create: mockCreate,
              },
            },
          }) as any,
      );

      const provider = new XaiProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response from grok");
    });

    it("initializes OpenAI client with xAI base URL", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "response" } }],
      });
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            chat: {
              completions: {
                create: mockCreate,
              },
            },
          }) as any,
      );

      const provider = new XaiProvider();
      await provider.send("test");

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "test-xai-key",
        baseURL: PROVIDER.XAI.BASE_URL,
      });
    });

    it("resolves XAI_API_KEY from environment", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "response" } }],
      });
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            chat: {
              completions: {
                create: mockCreate,
              },
            },
          }) as any,
      );

      const provider = new XaiProvider();
      await provider.send("test");

      expect(getEnvSecret).toHaveBeenCalledWith(PROVIDER.XAI.API_KEY);
    });
  });
});
