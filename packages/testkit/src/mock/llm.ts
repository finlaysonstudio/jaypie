import { createMockFunction } from "./utils";

// Constants for mock values
const TAG = "LLM";

export const getCompletion = createMockFunction<
  (prompt: string, options?: any) => Promise<string>
>(async () => "This is a mock completion response");

export const getCompletionStream = createMockFunction<
  (prompt: string, options?: any) => AsyncIterable<any>
>(async function* () {
  yield { content: "This " };
  yield { content: "is " };
  yield { content: "a " };
  yield { content: "mock " };
  yield { content: "streaming " };
  yield { content: "response" };
});

// Add missing Llm class
export class Llm {
  static instance: Llm;
  history: Array<{ role: string, content: string }> = [];

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
  async send(messages: Array<{ role: string, content: string }>, options = {}): Promise<string> {
    this.history = [...this.history, ...messages];
    return `_MOCK_LLM_RESPONSE_[${TAG}]`;
  }

  // Stream completion method
  async *stream(messages: Array<{ role: string, content: string }>, options = {}): AsyncGenerator<any> {
    this.history = [...this.history, ...messages];
    yield { content: `_MOCK_LLM_STREAM_[${TAG}]_` };
    yield { content: "part1 " };
    yield { content: "part2 " };
    yield { content: "part3" };
  }

  // Operate method (tool using)
  async operate(question: string, context = {}, options = {}): Promise<any> {
    this.history.push({ role: "user", content: question });
    this.history.push({ role: "assistant", content: `_MOCK_LLM_OPERATE_[${TAG}]` });
    return { result: `_MOCK_LLM_OPERATE_RESULT_[${TAG}]`, raw: {} };
  }

  // Static methods
  static async send(messages: Array<{ role: string, content: string }>, options = {}): Promise<string> {
    return Llm.getInstance().send(messages, options);
  }

  static async *stream(messages: Array<{ role: string, content: string }>, options = {}): AsyncGenerator<any> {
    yield* Llm.getInstance().stream(messages, options);
  }

  static async operate(question: string, context = {}, options = {}): Promise<any> {
    return Llm.getInstance().operate(question, context, options);
  }
}

// Tool implementations
export const random = createMockFunction<
  (min?: number, max?: number, precision?: number) => number
>((min = 0, max = 1, precision = 0) => {
  const value = min + (Math.random() * (max - min));
  return precision === 0 ? Math.floor(value) : Number(value.toFixed(precision));
});

export const roll = createMockFunction<
  (dice: string) => { rolls: number[], total: number }
>((dice) => {
  // Just return mock value for consistency
  return {
    rolls: [4, 5, 6],
    total: 15,
    dice: `_MOCK_ROLL_[${TAG}][${dice}]`
  };
});

export const time = createMockFunction<
  (format?: string, timezone?: string) => string
>((format = "iso", timezone = "UTC") => {
  return `_MOCK_TIME_[${TAG}][${format}][${timezone}]`;
});

export const weather = createMockFunction<
  (location: string, days?: number) => Promise<any>
>(async (location, days = 1) => {
  return {
    location: `_MOCK_WEATHER_LOCATION_[${TAG}][${location}]`,
    forecast: Array(days).fill(0).map((_, i) => ({
      date: `2025-05-${i + 1}`,
      temperature: 72,
      condition: "Sunny",
      precipitation: 0
    }))
  };
});

// Tool collections
export const toolkit = {
  random,
  roll,
  time,
  weather
};

export const tools = Object.values(toolkit);

// Standalone operate function
export const operate = createMockFunction<
  (question: string, context: any, options?: any) => Promise<any>
>(async (question, context, options) => {
  return Llm.operate(question, context, options);
});
