import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetLlmObs, _setLlmObs, LlmObsAnnotation } from "../llmobs.js";
import { OperateLoop } from "../../operate/OperateLoop.js";
import { BaseProviderAdapter } from "../../operate/adapters/index.js";
import {
  LlmHistory,
  LlmMessageRole,
  LlmMessageType,
} from "../../types/LlmProvider.interface.js";
import {
  ErrorCategory,
  ParsedResponse,
  StandardToolCall,
} from "../../operate/types.js";
import { Toolkit } from "../../tools/Toolkit.class.js";

//
//
// Fake SDK
//

interface RecordedSpan {
  annotations: LlmObsAnnotation[];
  options: { kind: string; name: string };
}

function makeFakeSdk() {
  const spans: RecordedSpan[] = [];
  const sdk = {
    annotate(span: unknown, annotation: LlmObsAnnotation) {
      // No active-span store in the fake; attribute to the most-recent span.
      const target = (span as RecordedSpan) ?? spans[spans.length - 1];
      target?.annotations.push(annotation);
    },
    trace(
      options: { kind: string; name: string },
      fn: (span: unknown) => unknown,
    ) {
      const span: RecordedSpan = { annotations: [], options };
      spans.push(span);
      return fn(span);
    },
  };
  return { sdk, spans };
}

//
//
// Mock Adapter
//

class ToolThenTextAdapter extends BaseProviderAdapter {
  readonly defaultModel = "mock-model";
  readonly name = "mock";

  private turn = 0;

  buildRequest = vi.fn((request) => request);
  formatTools = vi.fn((toolkit: Toolkit) =>
    toolkit.tools.map((t: { description: string; name: string }) => ({
      description: t.description,
      name: t.name,
      parameters: {},
    })),
  );
  formatOutputSchema = vi.fn((schema) => schema);

  executeRequest = vi.fn(() => Promise.resolve({ turn: this.turn }));

  parseResponse = vi.fn((): ParsedResponse => {
    this.turn += 1;
    if (this.turn === 1) {
      return {
        content: "",
        hasToolCalls: true,
        raw: { turn: 1 },
        usage: {
          input: 10,
          output: 5,
          provider: "mock",
          reasoning: 0,
          total: 15,
        },
      };
    }
    return {
      content: "Done",
      hasToolCalls: false,
      raw: { turn: 2 },
      usage: { input: 4, output: 6, provider: "mock", reasoning: 0, total: 10 },
    };
  });

  extractToolCalls = vi.fn((response: { turn: number }): StandardToolCall[] => {
    if (response.turn === 0) {
      return [
        {
          arguments: JSON.stringify({ city: "NYC" }),
          callId: "call-1",
          name: "get_weather",
          raw: {},
        },
      ];
    }
    return [];
  });

  formatToolResult = vi.fn((toolCall, result) => ({
    content: result.output,
    tool_use_id: toolCall.callId,
    type: "tool_result",
  }));
  appendToolResult = vi.fn((request) => request);
  responseToHistoryItems = vi.fn((): LlmHistory => [
    {
      content: "Done",
      role: LlmMessageRole.Assistant,
      type: LlmMessageType.Message,
    },
  ]);
  extractUsage = vi.fn(() => ({
    input: 0,
    model: "mock-model",
    output: 0,
    provider: "mock",
    reasoning: 0,
    total: 0,
  }));
  classifyError = vi.fn(() => ({
    category: ErrorCategory.Unknown,
    error: new Error("Test"),
    shouldRetry: true,
  }));
  isComplete = vi.fn(() => true);
}

//
//
// Setup
//

const ORIGINAL = process.env.DD_LLMOBS_ENABLED;

beforeEach(() => {
  _resetLlmObs();
});

afterEach(() => {
  _resetLlmObs();
  vi.clearAllMocks();
  if (ORIGINAL === undefined) {
    delete process.env.DD_LLMOBS_ENABLED;
  } else {
    process.env.DD_LLMOBS_ENABLED = ORIGINAL;
  }
});

//
//
// Tests
//

describe("OperateLoop LLM Observability", () => {
  it("Emits no spans when DD_LLMOBS_ENABLED is unset", async () => {
    delete process.env.DD_LLMOBS_ENABLED;
    const { sdk, spans } = makeFakeSdk();
    _setLlmObs(sdk);

    const toolkit = new Toolkit([
      {
        call: async () => "sunny",
        description: "Get current weather",
        name: "get_weather",
        type: "function",
        parameters: { properties: {}, type: "object" },
      },
    ]);

    const loop = new OperateLoop({
      adapter: new ToolThenTextAdapter(),
      client: {},
    });
    const result = await loop.execute("Hello", { tools: toolkit, turns: 3 });

    expect(result.content).toBe("Done");
    expect(spans).toHaveLength(0);
  });

  it("Emits enclosing llm span + model span for a simple operate", async () => {
    process.env.DD_LLMOBS_ENABLED = "true";
    const { sdk, spans } = makeFakeSdk();
    _setLlmObs(sdk);

    // Adapter that completes on the first turn (no tools)
    const adapter = new ToolThenTextAdapter();
    adapter.parseResponse = vi.fn((): ParsedResponse => ({
      content: "Hi",
      hasToolCalls: false,
      raw: {},
      usage: {
        input: 1,
        output: 2,
        provider: "mock",
        reasoning: 0,
        total: 3,
      },
    }));

    const loop = new OperateLoop({ adapter, client: {} });
    await loop.execute("Hello");

    const kinds = spans.map((s) => s.options.kind);
    expect(kinds).toContain("llm");
    // Enclosing span (no tools) is kind "llm"; model span is also "llm"
    expect(
      spans.filter((s) => s.options.name === "jaypie.llm.operate"),
    ).toHaveLength(1);
    expect(
      spans.filter((s) => s.options.name === "jaypie.llm.model"),
    ).toHaveLength(1);
  });

  it("Emits agent + llm + tool spans through a tool-calling turn", async () => {
    process.env.DD_LLMOBS_ENABLED = "true";
    const { sdk, spans } = makeFakeSdk();
    _setLlmObs(sdk);

    const toolkit = new Toolkit([
      {
        call: async () => "sunny",
        description: "Get current weather",
        name: "get_weather",
        type: "function",
        parameters: {
          properties: { city: { type: "string" } },
          type: "object",
        },
      },
    ]);

    const loop = new OperateLoop({
      adapter: new ToolThenTextAdapter(),
      client: {},
    });
    const result = await loop.execute("Weather in NYC?", {
      tools: toolkit,
      turns: 3,
    });

    expect(result.content).toBe("Done");

    const byName = (name: string) =>
      spans.filter((s) => s.options.name === name);

    // Enclosing span is an agent (tools present)
    const enclosing = byName("jaypie.llm.operate");
    expect(enclosing).toHaveLength(1);
    expect(enclosing[0].options.kind).toBe("agent");

    // One model span per turn (2 turns)
    expect(byName("jaypie.llm.model")).toHaveLength(2);

    // One tool span, kind tool, annotated with input/output
    const toolSpans = spans.filter((s) => s.options.kind === "tool");
    expect(toolSpans).toHaveLength(1);
    expect(toolSpans[0].options.name).toBe("get_weather");
    expect(toolSpans[0].annotations[0]).toMatchObject({
      inputData: JSON.stringify({ city: "NYC" }),
      outputData: "sunny",
    });
  });
});
