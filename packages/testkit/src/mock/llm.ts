import { vi } from "vitest";
import {
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockTool,
  createMockWrappedObject,
} from "./utils";

import * as original from "@jaypie/llm";

export const LLM = original.LLM;

const mockOperate = createMockResolvedFunction({
  content: "_MOCK_OUTPUT_TEXT",
  history: [
    {
      content: "_MOCK_USER_INPUT",
      role: "user",
      type: "message",
    },
    {
      id: "_MOCK_MESSAGE_ID",
      type: "message",
      status: "completed",
      content: "_MOCK_CONTENT",
      role: "assistant",
    },
  ],
  model: "_MOCK_MODEL",
  output: [
    {
      id: "_MOCK_MESSAGE_ID",
      type: "message",
      status: "completed",
      content: "_MOCK_CONTENT",
      role: "assistant",
    },
  ],
  provider: "_MOCK_PROVIDER",
  reasoning: [],
  responses: [
    {
      id: "_MOCK_RESPONSE_ID",
      object: "response",
      created_at: Date.now() / 1000,
      status: "completed",
      error: null,
      output_text: "_MOCK_OUTPUT_TEXT",
    },
  ],
  status: "completed",
  usage: [
    {
      input: 100,
      output: 20,
      reasoning: 0,
      total: 120,
      provider: "_MOCK_PROVIDER",
      model: "_MOCK_MODEL",
    },
  ],
});
const mockSend = createMockResolvedFunction("_MOCK_LLM_RESPONSE");
export const Llm = Object.assign(
  vi.fn().mockImplementation((providerName = "_MOCK_LLM_PROVIDER") => ({
    _provider: providerName,
    _llm: {
      operate: mockOperate,
      send: mockSend,
    },
    operate: mockOperate,
    send: mockSend,
  })),
  {
    operate: mockOperate,
    send: mockSend,
  },
);

// Tool implementations - always return mock values
const random = createMockTool("random", createMockReturnedFunction(0.5));

const roll = createMockTool("roll", createMockReturnedFunction(6));

const time = createMockTool("time", createMockReturnedFunction(`_MOCK_TIME`));

const weather = createMockTool(
  "weather",
  createMockResolvedFunction({
    location: `_MOCK_WEATHER_LOCATION`,
    forecast: [{ conditions: "good" }],
  }),
);

export const Toolkit = createMockWrappedObject(original.Toolkit, {
  isClass: true,
});

export const JaypieToolkit = createMockWrappedObject(original.JaypieToolkit, {
  isClass: true,
});

export const LlmMessageRole = createMockWrappedObject(original.LlmMessageRole, {
  isClass: true,
});
export const LlmMessageType = createMockWrappedObject(original.LlmMessageType, {
  isClass: true,
});
export const LlmStreamChunkType = createMockWrappedObject(
  original.LlmStreamChunkType,
  {
    isClass: true,
  },
);

// Provider mocks
export const GeminiProvider = createMockWrappedObject(original.GeminiProvider, {
  isClass: true,
});
export const OpenRouterProvider = createMockWrappedObject(
  original.OpenRouterProvider,
  {
    isClass: true,
  },
);

// Type guards and utilities - re-export from original (these are pure functions)
export const extractReasoning = original.extractReasoning;
export const isLlmOperateInput = original.isLlmOperateInput;
export const isLlmOperateInputContent = original.isLlmOperateInputContent;
export const isLlmOperateInputFile = original.isLlmOperateInputFile;
export const isLlmOperateInputImage = original.isLlmOperateInputImage;

// Tool collections
export const toolkit = new original.JaypieToolkit([
  random,
  roll,
  time,
  weather,
]);

export const tools = toolkit.tools;
