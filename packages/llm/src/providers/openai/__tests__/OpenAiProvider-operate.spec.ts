import { getEnvSecret } from "@jaypie/aws";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  OpenAI,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
import { log } from "../../../util/logger.js";
import { restoreLog, spyLog } from "@jaypie/testkit";
import { sleep } from "@jaypie/core";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";
import { OpenAiProvider } from "../OpenAiProvider.class";
import { MAX_RETRIES_DEFAULT_LIMIT } from "../operate";
import { OpenAIResponse } from "../types";
import { LlmTool } from "../../../types/LlmTool.interface";
import { formatOperateInput, formatOperateMessage } from "../../../util";

vi.mock("openai");

const MOCK = {
  INSTRUCTIONS: "You are a helpful assistant",
  RESPONSE: {
    TEXT: {
      id: "resp_123",
      content: [{ text: "Cilantro is a good taco ingredient" }],
    },
  },
};

beforeAll(async () => {
  vi.spyOn(await import("@jaypie/core"), "sleep").mockResolvedValue(undefined);
});
beforeEach(async () => {
  spyLog(log);
});

afterEach(() => {
  vi.clearAllMocks();
  restoreLog(log);
});

const mockCreate = vi.fn().mockResolvedValue(MOCK.RESPONSE.TEXT);

describe("OpenAiProvider.operate", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          responses: {
            create: mockCreate,
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-key");
  });

  describe("Features", () => {
    let provider: OpenAiProvider;
    beforeEach(() => {
      provider = new OpenAiProvider();
    });
    describe("Chat history", () => {
      it.skip("Passes chat history to the OpenAI API", async () => {
        // Setup
        const mockResponse = {
          id: "resp_123",
          content: [{ text: "Response with chat history" }],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);
        const history = [
          { role: "user", content: "test input" },
          { role: "assistant", content: "test response" },
        ];

        // Execute
        const result = await provider.operate("test message #3", {
          history,
        });

        // Verify
        const expectedInput = [
          ...history,
          formatOperateMessage("test message #3"),
        ];
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: expectedInput,
        });
        expect(result).toEqual([mockResponse]);
      });
      it.todo("Passes tool calls and results to the OpenAI API");
      it("Instances track history by default", async () => {
        // Setup
        const firstMessage = "Test message #1";
        const secondMessage = "Test message #2";
        const mockResponse = {
          id: "resp_123",
          content: [{ text: "Response to message #1" }],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);
        const result = await provider.operate(firstMessage);
        expect(result).toEqual([mockResponse]);
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: formatOperateInput(firstMessage),
        });
        const secondMockResponse = {
          id: "resp_123",
          content: [{ text: "Response to message #2" }],
        };
        mockCreate.mockResolvedValueOnce(secondMockResponse);
        const secondResult = await provider.operate(secondMessage);
        expect(secondResult).toEqual([secondMockResponse]);
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: [
            formatOperateMessage(firstMessage),
            expect.any(Object),
            formatOperateMessage(secondMessage),
          ],
        });
      });
    });
  });
});
