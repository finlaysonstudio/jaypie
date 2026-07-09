import { beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "@jaypie/logger";

import { tallyOperate } from "../tallyOperate.js";

//
//
// Mock
//

vi.mock("@jaypie/logger", () => ({
  log: {
    tally: vi.fn(),
  },
}));

//
//
// Tests
//

describe("tallyOperate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof tallyOperate).toBe("function");
    });

    it("tallies with only turns", () => {
      tallyOperate({ turns: 1 });
      expect(log.tally).toHaveBeenCalledWith({
        llm: { operates: 1, toolCalls: 0, turns: 1 },
      });
    });
  });

  describe("Features", () => {
    it("includes a per-tool breakdown when tools were called", () => {
      tallyOperate({
        toolCallNames: ["get_weather", "roll", "get_weather"],
        turns: 3,
      });
      expect(log.tally).toHaveBeenCalledWith({
        llm: {
          operates: 1,
          toolCalls: 3,
          tools: { get_weather: 2, roll: 1 },
          turns: 3,
        },
      });
    });

    it("aggregates usage by provider and model", () => {
      tallyOperate({
        turns: 2,
        usage: [
          {
            input: 10,
            model: "mock-model",
            output: 20,
            provider: "mock",
            reasoning: 0,
            total: 30,
          },
          {
            input: 5,
            model: "mock-model",
            output: 10,
            provider: "mock",
            reasoning: 5,
            total: 20,
          },
          {
            input: 1,
            model: "other-model",
            output: 2,
            provider: "other",
            reasoning: 0,
            total: 3,
          },
        ],
      });
      expect(log.tally).toHaveBeenCalledWith({
        llm: {
          operates: 1,
          toolCalls: 0,
          turns: 2,
          usage: {
            "mock:mock-model": {
              input: 15,
              output: 30,
              reasoning: 5,
              total: 50,
            },
            "other:other-model": {
              input: 1,
              output: 2,
              reasoning: 0,
              total: 3,
            },
          },
        },
      });
    });

    it("keys usage as unknown when provider and model are absent", () => {
      tallyOperate({
        turns: 1,
        usage: [{ input: 1, output: 2, reasoning: 0, total: 3 }],
      });
      expect(log.tally).toHaveBeenCalledWith({
        llm: {
          operates: 1,
          toolCalls: 0,
          turns: 1,
          usage: { unknown: { input: 1, output: 2, reasoning: 0, total: 3 } },
        },
      });
    });
  });
});
