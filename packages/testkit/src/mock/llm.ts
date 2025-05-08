/* eslint-disable @typescript-eslint/no-unused-vars */

import { vi } from "vitest";
import {
  createMockFunction,
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockWrappedFunction,
  createMockWrappedObject,
} from "./utils";

// Constants for mock values
const TAG = "LLM";

export const mockOperate = createMockResolvedFunction({
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
  output: [
    {
      id: "_MOCK_MESSAGE_ID",
      type: "message",
      status: "completed",
      content: "_MOCK_CONTENT",
      role: "assistant",
    },
  ],
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
  usage: { input: 100, output: 20, reasoning: 0, total: 120 },
  content: "_MOCK_OUTPUT_TEXT",
});
export const mockSend = createMockResolvedFunction("_MOCK_LLM_RESPONSE");
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
const random = createMockReturnedFunction(0.5);

const roll = createMockReturnedFunction(6);

const time = createMockReturnedFunction(`_MOCK_TIME_[${TAG}]`);

const weather = createMockResolvedFunction({
  location: `_MOCK_WEATHER_LOCATION_[${TAG}]`,
  forecast: Array(7)
    .fill(0)
    .map((_, i) => ({
      date: `2025-05-${i + 1}`,
      temperature: 72,
      condition: "Sunny",
      precipitation: 0,
    })),
});

// Tool collections
export const toolkit = {
  random,
  roll,
  time,
  weather,
};

export const tools = Object.values(toolkit);
