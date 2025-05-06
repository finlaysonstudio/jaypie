/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// Constants for mock values
const TAG = "LLM";

// Define types for the mock
type LlmMessage = { role: string; content: string };
type LlmOptions = Record<string, any>;

// Create the mock class
export const Llm = vi.fn().mockImplementation(function Llm(
  this: any,
  config = {},
) {
  this.history = [];
}) as unknown as typeof Llm;

// Create mock functions for static methods
const mockSend = vi.fn().mockImplementation(async function send(
  messages: LlmMessage[],
  options = {},
) {
  const instance = Llm.getInstance();
  return instance.send(messages, options || {});
});

const mockOperate = vi.fn().mockImplementation(async function operate(
  question: string,
  context = {},
  options = {},
) {
  const instance = Llm.getInstance();
  return instance.operate(question, context || {}, options || {});
});

// Add static properties and methods to the mock
Object.assign(Llm, {
  instance: undefined as any,
  getInstance: vi.fn().mockImplementation(function getInstance(config = {}) {
    if (!Llm.instance) {
      Llm.instance = new Llm(config);
    }
    return Llm.instance;
  }),
  send: mockSend,
  operate: mockOperate,
});

// Add instance methods to the prototype
Llm.prototype.send = vi.fn().mockImplementation(async function send(
  messages: LlmMessage[],
  options = {},
): Promise<string> {
  this.history = [...this.history, ...messages];
  return `_MOCK_LLM_RESPONSE_[${TAG}]`;
});

Llm.prototype.operate = vi.fn().mockImplementation(async function operate(
  question: string,
  context = {},
  options = {},
): Promise<any> {
  this.history.push({ role: "user", content: question });
  this.history.push({
    role: "assistant",
    content: `_MOCK_LLM_OPERATE_[${TAG}]`,
  });
  return { result: `_MOCK_LLM_OPERATE_RESULT_[${TAG}]`, raw: {} };
});

// Tool implementations - always return mock values
const random = vi.fn(() => {
  return 0.5;
});

const roll = vi.fn(() => {
  return 6;
});

const time = vi.fn(() => {
  return `_MOCK_TIME_[${TAG}]`;
});

const weather = vi.fn(async (options?: any) => {
  const { location, days = 1 } = options || {};
  return {
    location: `_MOCK_WEATHER_LOCATION_[${TAG}][${location}]`,
    forecast: Array(days)
      .fill(0)
      .map((_, i) => ({
        date: `2025-05-${i + 1}`,
        temperature: 72,
        condition: "Sunny",
        precipitation: 0,
      })),
  };
});

// Tool collections
export const toolkit = {
  random,
  roll,
  time,
  weather,
};

export const tools = Object.values(toolkit);
