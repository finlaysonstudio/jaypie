/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// Constants for mock values
const TAG = "LLM";

// Add missing Llm class
export class Llm {
  static instance: Llm;
  history: Array<{ role: string; content: string }> = [];

  constructor(config = {}) {
    this.history = [];
  }

  // Get singleton instance
  static getInstance(config = {}): Llm {
    if (!Llm.instance) {
      Llm.instance = new Llm(config);
    }
    return Llm.instance;
  }

  // Main completion method
  async send(
    messages: Array<{ role: string; content: string }>,
    options = {},
  ): Promise<string> {
    this.history = [...this.history, ...messages];
    return `_MOCK_LLM_RESPONSE_[${TAG}]`;
  }

  // Operate method (tool using)
  async operate(question: string, context = {}, options = {}): Promise<any> {
    this.history.push({ role: "user", content: question });
    this.history.push({
      role: "assistant",
      content: `_MOCK_LLM_OPERATE_[${TAG}]`,
    });
    return { result: `_MOCK_LLM_OPERATE_RESULT_[${TAG}]`, raw: {} };
  }

  // Static methods
  static async send(
    messages: Array<{ role: string; content: string }>,
    options = {},
  ): Promise<string> {
    return Llm.getInstance().send(messages, options);
  }

  static async operate(
    question: string,
    context = {},
    options = {},
  ): Promise<any> {
    return Llm.getInstance().operate(question, context, options);
  }
}
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
