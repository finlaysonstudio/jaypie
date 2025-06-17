import { vi } from "vitest";
import {
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockTool,
  createMockWrappedObject,
} from "./utils";

import * as original from "@jaypie/llm";

// Constants for mock values
const TAG = "LLM";

export const LLM = original.LLM;

const mockOperate = createMockResolvedFunction({
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
  content: "_MOCK_OUTPUT_TEXT",
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

// Tool collections
export const toolkit = new original.Toolkit([random, roll, time, weather]);

export const tools = toolkit.tools;
