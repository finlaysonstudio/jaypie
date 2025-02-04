import { getEnvSecret } from "@jaypie/aws";
import { OpenAI } from "openai";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAiProvider } from "../providers/OpenAiProvider.class";

vi.mock("openai");

describe("OpenAiProvider", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: vi.fn(),
            },
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(OpenAiProvider).toBeFunction();
    });

    it("Works", () => {
      const provider = new OpenAiProvider();
      expect(provider).toBeInstanceOf(OpenAiProvider);
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new OpenAiProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-key");
    });

    it("sends messages to OpenAI", async () => {
      const mockResponse = {
        choices: [{ message: { content: "test response" } }],
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

      const provider = new OpenAiProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response");
      expect(mockCreate).toHaveBeenCalledWith({
        messages: [{ role: "user", content: "test message" }],
        model: expect.any(String),
      });
    });
  });
});
