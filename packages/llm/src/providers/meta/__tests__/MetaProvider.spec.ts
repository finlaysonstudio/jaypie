import { getEnvSecret } from "@jaypie/aws";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROVIDER } from "../../../constants.js";
import { OpenAIClient } from "../../openai/client.js";
import { MetaProvider } from "../MetaProvider.class";

// Mock the OpenAI client
vi.mock("../../openai/client.js");

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

const mockCompletion = (content = "response") => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  vi.mocked(OpenAIClient).mockImplementation(
    class {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    } as any,
  );
  return mockCreate;
};

describe("MetaProvider", () => {
  beforeEach(() => {
    vi.mocked(getEnvSecret).mockClear();
    vi.mocked(OpenAIClient).mockClear();
    vi.mocked(OpenAIClient).mockImplementation(
      class {
        chat = {
          completions: {
            create: vi.fn(),
            parse: vi.fn(),
          },
        };
      } as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-meta-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(MetaProvider).toBeFunction();
    });

    it("Works", () => {
      const provider = new MetaProvider();
      expect(provider).toBeInstanceOf(MetaProvider);
    });

    it("defaults to the Meta default model", () => {
      const provider = new MetaProvider();
      expect(provider["model"]).toBe(PROVIDER.META.DEFAULT);
    });

    it("accepts a custom model", () => {
      const provider = new MetaProvider("muse-spark-1.2");
      expect(provider["model"]).toBe("muse-spark-1.2");
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when neither key is set", async () => {
      const provider = new MetaProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    it("sends messages using the OpenAI-compatible client", async () => {
      mockCompletion("test response from muse");

      const provider = new MetaProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response from muse");
    });

    it("initializes the client with the Meta base URL", async () => {
      mockCompletion();

      const provider = new MetaProvider();
      await provider.send("test");

      expect(OpenAIClient).toHaveBeenCalledWith({
        apiKey: "test-meta-key",
        baseURL: PROVIDER.META.BASE_URL,
      });
    });
  });

  describe("Features", () => {
    describe("Key resolution", () => {
      it("prefers an explicit apiKey over the environment", async () => {
        mockCompletion();

        const provider = new MetaProvider(undefined, { apiKey: "explicit" });
        await provider.send("test");

        expect(getEnvSecret).not.toHaveBeenCalled();
        expect(OpenAIClient).toHaveBeenCalledWith({
          apiKey: "explicit",
          baseURL: PROVIDER.META.BASE_URL,
        });
      });

      it("reads META_API_KEY first and stops there", async () => {
        mockCompletion();

        const provider = new MetaProvider();
        await provider.send("test");

        expect(getEnvSecret).toHaveBeenCalledTimes(1);
        expect(getEnvSecret).toHaveBeenCalledWith(PROVIDER.META.API_KEY);
      });

      it("falls back to MODEL_API_KEY when META_API_KEY is unset", async () => {
        mockCompletion();
        vi.mocked(getEnvSecret).mockImplementation(async (name: string) =>
          name === PROVIDER.META.API_KEY_FALLBACK ? "fallback-key" : "",
        );

        const provider = new MetaProvider();
        await provider.send("test");

        expect(getEnvSecret).toHaveBeenNthCalledWith(1, PROVIDER.META.API_KEY);
        expect(getEnvSecret).toHaveBeenNthCalledWith(
          2,
          PROVIDER.META.API_KEY_FALLBACK,
        );
        expect(OpenAIClient).toHaveBeenCalledWith({
          apiKey: "fallback-key",
          baseURL: PROVIDER.META.BASE_URL,
        });
      });
    });
  });
});
