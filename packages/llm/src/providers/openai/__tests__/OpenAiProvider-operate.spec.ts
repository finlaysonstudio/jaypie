import { getEnvSecret } from "@jaypie/aws";
import { OpenAI } from "openai";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAiProvider } from "../OpenAiProvider.class";
import { PROVIDER } from "../../../constants.js";

vi.mock("openai");

describe("OpenAiProvider.operate", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          responses: {
            create: vi.fn(),
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-key");
  });

  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(OpenAiProvider).toBeClass();
      const provider = new OpenAiProvider();
      expect(provider).toBeInstanceOf(OpenAiProvider);
      expect(provider.operate).toBeFunction();
    });
    it("Works", async () => {
      const provider = new OpenAiProvider();
      const result = await provider.operate("test");
      expect(result).toBeArray();
    });
    it("Works how we expect", async () => {
      // Setup
      const mockResponse = [
        {
          id: "resp_123",
          content: [{ text: "Cilantro is a good taco ingredient" }],
        },
      ];
      const mockCreate = vi.fn().mockResolvedValue(mockResponse[0]);
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            responses: {
              create: mockCreate,
            },
          }) as any,
      );
      // Execute
      const provider = new OpenAiProvider("mock-model");
      const testInput = "What is a good taco ingredient?";
      const result = await provider.operate(testInput);
      // Verify
      expect(result).toBeArray();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "mock-model",
        input: testInput,
      });
    });
  });
});
