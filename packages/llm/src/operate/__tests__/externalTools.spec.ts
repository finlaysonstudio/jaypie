import { beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestError } from "@jaypie/errors";

import {
  MAX_CONSECUTIVE_TOOL_ERRORS,
  OperateLoop,
  OperateLoopConfig,
} from "../OperateLoop.js";
import { StreamLoop, StreamLoopConfig } from "../StreamLoop.js";
import { BaseProviderAdapter } from "../adapters/index.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  LlmExchangeEnvelope,
  LlmMessageType,
  LlmProgressEvent,
  LlmProgressEventType,
  LlmResponseStatus,
} from "../../types/LlmProvider.interface.js";
import { LlmTool } from "../../types/LlmTool.interface.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../types/LlmStreamChunk.interface.js";
import { ErrorCategory, ParsedResponse, StandardToolCall } from "../types.js";

//
//
// Mock
//

vi.mock("@jaypie/kit", () => ({
  JAYPIE: {
    LIB: {
      LLM: "@jaypie/llm",
    },
  },
  placeholders: vi.fn((str: string) => str),
  resolveValue: vi.fn((val) => val),
  sleep: vi.fn(() => Promise.resolve()),
}));

vi.mock("@jaypie/logger", () => ({
  log: {
    lib: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      trace: Object.assign(vi.fn(), { var: vi.fn() }),
      var: vi.fn(),
      warn: vi.fn(),
    })),
    tally: vi.fn(),
  },
}));

//
//
// Fixtures
//

const MOCK_USAGE = {
  input: 10,
  model: "mock-model",
  output: 20,
  provider: "mock",
  reasoning: 0,
  total: 30,
};

const EXTERNAL_TOOL: LlmTool = {
  description: "Open a card in the canvas",
  external: true,
  name: "open_card",
  parameters: { type: "object" },
  type: "function",
};

function completionResponse(response: unknown): ParsedResponse {
  return {
    content: "Done!",
    hasToolCalls: false,
    raw: response,
    stopReason: "end_turn",
    usage: { ...MOCK_USAGE },
  };
}

function toolCallResponse(response: unknown): ParsedResponse {
  return {
    content: undefined,
    hasToolCalls: true,
    raw: response,
    stopReason: "tool_use",
    usage: { ...MOCK_USAGE },
  };
}

class MockAdapter extends BaseProviderAdapter {
  readonly name = "mock";
  readonly defaultModel = "mock-model";

  buildRequest = vi.fn((request) => request);
  formatTools = vi.fn((toolkit: Toolkit) =>
    toolkit.tools.map((t: { name: string; description: string }) => ({
      description: t.description,
      name: t.name,
      parameters: {},
    })),
  );
  formatOutputSchema = vi.fn((schema) => schema);
  executeRequest = vi.fn(() => Promise.resolve({ id: "resp-1" }));
  executeStreamRequest = vi.fn(
    async function* (): AsyncIterable<LlmStreamChunk> {
      yield { content: "Hello", type: LlmStreamChunkType.Text };
      yield { type: LlmStreamChunkType.Done, usage: [{ ...MOCK_USAGE }] };
    },
  );
  parseResponse = vi.fn((response): ParsedResponse =>
    completionResponse(response),
  );
  extractToolCalls = vi.fn((): StandardToolCall[] => []);
  extractUsage = vi.fn(() => ({ ...MOCK_USAGE }));
  formatToolResult = vi.fn((toolCall, result) => ({
    content: result.output,
    tool_use_id: toolCall.callId,
    type: "tool_result",
  }));
  appendToolResult = vi.fn((request) => request);
  responseToHistoryItems = vi.fn(() => []);
  classifyError = vi.fn((error: unknown) => ({
    category: ErrorCategory.Unrecoverable,
    error,
    shouldRetry: false,
  }));
  isComplete = vi.fn(() => true);
  isRetryableError = vi.fn(() => false);
}

/** Adapter that requests the given tool calls on turn one, then completes. */
function parkAdapter(toolCalls: StandardToolCall[]): MockAdapter {
  const adapter = new MockAdapter();
  let turn = 0;
  adapter.parseResponse = vi.fn((response): ParsedResponse => {
    turn++;
    return turn === 1
      ? toolCallResponse(response)
      : completionResponse(response);
  });
  adapter.extractToolCalls = vi.fn((): StandardToolCall[] => toolCalls);
  return adapter;
}

function operateConfig(adapter: MockAdapter): OperateLoopConfig {
  return { adapter, client: {} };
}

function streamConfig(adapter: MockAdapter): StreamLoopConfig {
  return { adapter, client: {} };
}

async function collect(
  iterable: AsyncIterable<LlmStreamChunk>,
): Promise<LlmStreamChunk[]> {
  const chunks: LlmStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

/** Park once and return a JSON-round-tripped envelope, as a host would. */
async function parkedEnvelope(): Promise<LlmExchangeEnvelope> {
  const adapter = parkAdapter([
    { arguments: "{}", callId: "call-1", name: "open_card", raw: {} },
  ]);
  const loop = new OperateLoop(operateConfig(adapter));
  const parked = await loop.execute("Open the jobs card", {
    tools: new Toolkit([EXTERNAL_TOOL]),
    turns: 3,
  });
  return JSON.parse(JSON.stringify(parked.exchange));
}

//
//
// Tests
//

describe("External Tools and Suspend/Resume (Issue #473)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("Toolkit reports isExternal", () => {
      const toolkit = new Toolkit([EXTERNAL_TOOL]);
      expect(toolkit.isExternal("open_card")).toBe(true);
      expect(toolkit.isExternal("unknown")).toBe(false);
    });

    it("strips external from the provider payload", () => {
      const toolkit = new Toolkit([EXTERNAL_TOOL]);
      expect(toolkit.tools[0]).not.toHaveProperty("external");
    });
  });

  describe("Happy Paths", () => {
    it("parks at an external tool call", async () => {
      // Arrange
      const adapter = parkAdapter([
        {
          arguments: '{"card":"jobs"}',
          callId: "call-1",
          name: "open_card",
          raw: {},
        },
      ]);
      const events: LlmProgressEvent[] = [];
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const result = await loop.execute("Open the jobs card", {
        onProgress: (event) => {
          events.push(event);
        },
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 3,
      });
      // Assert
      expect(result.status).toBe(LlmResponseStatus.InProgress);
      expect(result.pending).toHaveLength(1);
      expect(result.pending?.[0]).toMatchObject({
        arguments: '{"card":"jobs"}',
        name: "open_card",
        xid: "call-1",
      });
      // The envelope attaches even though no onExchange was passed
      expect(result.exchange).toBeDefined();
      expect(result.exchange?.pending).toMatchObject({
        consecutiveToolErrors: 0,
        turn: 1,
      });
      expect(result.exchange?.pending?.calls[0].xid).toBe("call-1");
      // The pending history carries the neutral function_call item
      const functionCalls = result.exchange?.pending?.history.filter(
        (item) =>
          (item as { type?: string }).type === LlmMessageType.FunctionCall,
      );
      expect(functionCalls).toHaveLength(1);
      // tool_pending fired; the terminal done event did not
      expect(
        events.some((event) => event.type === LlmProgressEventType.ToolPending),
      ).toBe(true);
      expect(
        events.some((event) => event.type === LlmProgressEventType.Done),
      ).toBe(false);
      // Only one model request went out
      expect(adapter.executeRequest).toHaveBeenCalledTimes(1);
    });

    it("resumes a parked exchange and completes", async () => {
      // Arrange
      const envelope = await parkedEnvelope();
      const adapter = new MockAdapter();
      const loop = new OperateLoop(operateConfig(adapter));
      const onExchange = vi.fn();
      // Act
      const result = await loop.execute(undefined, {
        onExchange,
        resume: {
          exchange: envelope,
          results: [{ output: { opened: true }, xid: "call-1" }],
        },
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 3,
      });
      // Assert
      expect(result.status).toBe(LlmResponseStatus.Completed);
      expect(result.content).toBe("Done!");
      // Usage is cumulative: the parked segment's turn plus this one
      expect(result.usage).toHaveLength(2);
      // The model saw the function_call_output with the supplied result
      const request = adapter.buildRequest.mock.calls[0][0] as {
        messages: Array<{ type?: string; output?: string }>;
      };
      const output = request.messages.find(
        (item) => item.type === LlmMessageType.FunctionCallOutput,
      );
      expect(output?.output).toBe(JSON.stringify({ opened: true }));
      // The final historyDelta spans the whole exchange
      const delta = result.exchange?.response.historyDelta ?? [];
      expect(
        delta.some(
          (item) =>
            (item as { type?: string }).type === LlmMessageType.FunctionCall,
        ),
      ).toBe(true);
      expect(
        delta.some(
          (item) =>
            (item as { type?: string }).type ===
            LlmMessageType.FunctionCallOutput,
        ),
      ).toBe(true);
    });

    it("parks again on a consecutive external call", async () => {
      // Arrange
      const envelope = await parkedEnvelope();
      const adapter = parkAdapter([
        { arguments: "{}", callId: "call-2", name: "open_card", raw: {} },
      ]);
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const result = await loop.execute(undefined, {
        resume: {
          exchange: envelope,
          results: [{ output: "ok", xid: "call-1" }],
        },
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 4,
      });
      // Assert
      expect(result.status).toBe(LlmResponseStatus.InProgress);
      expect(result.exchange?.pending?.calls[0].xid).toBe("call-2");
      expect(result.exchange?.pending?.turn).toBe(2);
      // The new pending history retains the first call's result
      const outputs = result.exchange?.pending?.history.filter(
        (item) =>
          (item as { type?: string }).type ===
          LlmMessageType.FunctionCallOutput,
      );
      expect(outputs?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Features", () => {
    it("executes internal tools and parks only the external in a mixed turn", async () => {
      // Arrange
      const internalCall = vi.fn(() => "internal result");
      const adapter = parkAdapter([
        { arguments: "{}", callId: "call-a", name: "get_time", raw: {} },
        { arguments: "{}", callId: "call-b", name: "open_card", raw: {} },
      ]);
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const result = await loop.execute("Mixed", {
        tools: new Toolkit([
          EXTERNAL_TOOL,
          {
            call: internalCall,
            description: "Server time",
            name: "get_time",
            parameters: { type: "object" },
            type: "function",
          },
        ]),
        turns: 3,
      });
      // Assert
      expect(internalCall).toHaveBeenCalledTimes(1);
      expect(result.pending).toHaveLength(1);
      expect(result.pending?.[0].xid).toBe("call-b");
      const history = result.exchange?.pending?.history ?? [];
      const functionCalls = history.filter(
        (item) =>
          (item as { type?: string }).type === LlmMessageType.FunctionCall,
      );
      const outputs = history.filter(
        (item) =>
          (item as { type?: string }).type ===
          LlmMessageType.FunctionCallOutput,
      );
      expect(functionCalls).toHaveLength(2);
      // Only the internal call has an output; the external is outstanding
      expect(outputs).toHaveLength(1);
      expect((outputs[0] as { call_id?: string }).call_id).toBe("call-a");
    });

    it("formats an error result like the loop's own error tool_result", async () => {
      // Arrange
      const envelope = await parkedEnvelope();
      const adapter = new MockAdapter();
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      await loop.execute(undefined, {
        resume: {
          exchange: envelope,
          results: [{ error: "browser closed", xid: "call-1" }],
        },
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 3,
      });
      // Assert
      const request = adapter.buildRequest.mock.calls[0][0] as {
        messages: Array<{ type?: string; output?: string }>;
      };
      const output = request.messages.find(
        (item) => item.type === LlmMessageType.FunctionCallOutput,
      );
      expect(output?.output).toBe(JSON.stringify({ error: "browser closed" }));
    });

    it("enforces the consecutive tool error threshold across the boundary", async () => {
      // Arrange
      const envelope = await parkedEnvelope();
      envelope.pending!.consecutiveToolErrors = MAX_CONSECUTIVE_TOOL_ERRORS - 1;
      const adapter = new MockAdapter();
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const result = await loop.execute(undefined, {
        resume: {
          exchange: envelope,
          results: [{ error: "still failing", xid: "call-1" }],
        },
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 3,
      });
      // Assert — settles without a model call
      expect(result.status).toBe(LlmResponseStatus.Incomplete);
      expect(result.error?.title).toBe("Bad Function Call");
      expect(adapter.executeRequest).not.toHaveBeenCalled();
    });

    it("settles incomplete when resumed at an exhausted turn budget", async () => {
      // Arrange
      const envelope = await parkedEnvelope();
      const adapter = new MockAdapter();
      const loop = new OperateLoop(operateConfig(adapter));
      // Act — parked at turn 1, budget of 1
      const result = await loop.execute(undefined, {
        resume: {
          exchange: envelope,
          results: [{ output: "ok", xid: "call-1" }],
        },
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 1,
      });
      // Assert
      expect(result.status).toBe(LlmResponseStatus.Incomplete);
      expect(result.error?.status).toBe(429);
      expect(adapter.executeRequest).not.toHaveBeenCalled();
    });

    it("proceeds when the resumed budget is raised", async () => {
      // Arrange
      const envelope = await parkedEnvelope();
      const adapter = new MockAdapter();
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const result = await loop.execute(undefined, {
        resume: {
          exchange: envelope,
          results: [{ output: "ok", xid: "call-1" }],
        },
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 4,
      });
      // Assert
      expect(result.status).toBe(LlmResponseStatus.Completed);
      expect(adapter.executeRequest).toHaveBeenCalledTimes(1);
    });

    it("keeps the original startedAt and accumulates duration across segments", async () => {
      // Arrange
      const envelope = await parkedEnvelope();
      const adapter = new MockAdapter();
      const loop = new OperateLoop(operateConfig(adapter));
      const onExchange = vi.fn();
      // Act
      const result = await loop.execute(undefined, {
        onExchange,
        resume: {
          exchange: envelope,
          results: [{ output: "ok", xid: "call-1" }],
        },
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 3,
      });
      // Assert
      expect(result.exchange?.timing.startedAt).toBe(envelope.timing.startedAt);
      expect(result.exchange?.timing.duration).toBeGreaterThanOrEqual(
        envelope.timing.duration,
      );
    });

    it("parked envelope survives a JSON round-trip with no functions", async () => {
      // Arrange
      const adapter = parkAdapter([
        { arguments: "{}", callId: "call-1", name: "open_card", raw: {} },
      ]);
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const parked = await loop.execute("Open", {
        tools: new Toolkit([EXTERNAL_TOOL]),
        turns: 3,
      });
      // Assert
      const roundTripped = JSON.parse(JSON.stringify(parked.exchange));
      expect(roundTripped).toEqual(parked.exchange);
    });
  });

  describe("Error Conditions", () => {
    it("rejects resume of a non-parked exchange", async () => {
      // Arrange
      const adapter = new MockAdapter();
      const loop = new OperateLoop(operateConfig(adapter));
      const completed = await loop.execute("Hello", { onExchange: vi.fn() });
      // Act + Assert
      await expect(
        loop.execute(undefined, {
          resume: { exchange: completed.exchange!, results: [] },
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects resume with a missing result", async () => {
      const envelope = await parkedEnvelope();
      const loop = new OperateLoop(operateConfig(new MockAdapter()));
      await expect(
        loop.execute(undefined, {
          resume: { exchange: envelope, results: [] },
          tools: new Toolkit([EXTERNAL_TOOL]),
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects resume with an unexpected result", async () => {
      const envelope = await parkedEnvelope();
      const loop = new OperateLoop(operateConfig(new MockAdapter()));
      await expect(
        loop.execute(undefined, {
          resume: {
            exchange: envelope,
            results: [
              { output: "ok", xid: "call-1" },
              { output: "ok", xid: "call-9" },
            ],
          },
          tools: new Toolkit([EXTERNAL_TOOL]),
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects resume on a different provider", async () => {
      const envelope = await parkedEnvelope();
      envelope.resolution.provider = "other";
      const loop = new OperateLoop(operateConfig(new MockAdapter()));
      await expect(
        loop.execute(undefined, {
          resume: {
            exchange: envelope,
            results: [{ output: "ok", xid: "call-1" }],
          },
          tools: new Toolkit([EXTERNAL_TOOL]),
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects resume combined with input", async () => {
      const envelope = await parkedEnvelope();
      const loop = new OperateLoop(operateConfig(new MockAdapter()));
      await expect(
        loop.execute("More input", {
          resume: {
            exchange: envelope,
            results: [{ output: "ok", xid: "call-1" }],
          },
          tools: new Toolkit([EXTERNAL_TOOL]),
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects a call without input when not resuming", async () => {
      const loop = new OperateLoop(operateConfig(new MockAdapter()));
      await expect(loop.execute()).rejects.toThrow(BadRequestError);
    });

    it("Toolkit.call throws ConfigurationError for an external tool", async () => {
      const toolkit = new Toolkit([EXTERNAL_TOOL]);
      await expect(
        toolkit.call({ arguments: "{}", name: "open_card" }),
      ).rejects.toThrow("externally executed");
    });
  });

  describe("stream()", () => {
    function streamParkAdapter(): MockAdapter {
      const adapter = new MockAdapter();
      adapter.executeStreamRequest = vi.fn(
        async function* (): AsyncIterable<LlmStreamChunk> {
          yield {
            toolCall: { arguments: "{}", id: "call-s1", name: "open_card" },
            type: LlmStreamChunkType.ToolCall,
          };
          yield { type: LlmStreamChunkType.Done, usage: [{ ...MOCK_USAGE }] };
        },
      );
      return adapter;
    }

    it("parks at an external tool call and settles in_progress", async () => {
      // Arrange
      const adapter = streamParkAdapter();
      const onExchange = vi.fn();
      const loop = new StreamLoop(streamConfig(adapter));
      // Act
      const chunks = await collect(
        loop.execute("Open the jobs card", {
          onExchange,
          tools: new Toolkit([EXTERNAL_TOOL]),
          turns: 3,
        }),
      );
      // Assert
      const pendingChunk = chunks.find(
        (chunk) => chunk.type === LlmStreamChunkType.ToolPending,
      );
      expect(pendingChunk).toMatchObject({
        toolPending: { name: "open_card", xid: "call-s1" },
      });
      expect(chunks.at(-1)?.type).toBe(LlmStreamChunkType.Done);
      expect(onExchange).toHaveBeenCalledOnce();
      const envelope = onExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      expect(envelope.response.status).toBe(LlmResponseStatus.InProgress);
      expect(envelope.pending?.calls[0].xid).toBe("call-s1");
      expect(envelope.pending?.turn).toBe(1);
    });

    it("settles the parked envelope even without onExchange", async () => {
      // Arrange
      const adapter = streamParkAdapter();
      const loop = new StreamLoop(streamConfig(adapter));
      // Act + Assert — parking without a capture surface does not throw
      const chunks = await collect(
        loop.execute("Open the jobs card", {
          tools: new Toolkit([EXTERNAL_TOOL]),
          turns: 3,
        }),
      );
      expect(
        chunks.some((chunk) => chunk.type === LlmStreamChunkType.ToolPending),
      ).toBe(true);
    });

    it("resumes a parked stream and completes", async () => {
      // Arrange — park first
      const parkOnExchange = vi.fn();
      const parkLoop = new StreamLoop(streamConfig(streamParkAdapter()));
      await collect(
        parkLoop.execute("Open the jobs card", {
          onExchange: parkOnExchange,
          tools: new Toolkit([EXTERNAL_TOOL]),
          turns: 3,
        }),
      );
      const envelope = JSON.parse(
        JSON.stringify(parkOnExchange.mock.calls[0][0]),
      ) as LlmExchangeEnvelope;
      // Act — resume with the result
      const adapter = new MockAdapter();
      const onExchange = vi.fn();
      const loop = new StreamLoop(streamConfig(adapter));
      const chunks = await collect(
        loop.execute(undefined, {
          onExchange,
          resume: {
            exchange: envelope,
            results: [{ output: { opened: true }, xid: "call-s1" }],
          },
          tools: new Toolkit([EXTERNAL_TOOL]),
          turns: 3,
        }),
      );
      // Assert
      expect(
        chunks.some((chunk) => chunk.type === LlmStreamChunkType.Text),
      ).toBe(true);
      expect(chunks.at(-1)?.type).toBe(LlmStreamChunkType.Done);
      const settled = onExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      expect(settled.response.status).toBe(LlmResponseStatus.Completed);
      expect(settled.pending).toBeUndefined();
      // The model saw the function_call_output with the supplied result
      const request = adapter.buildRequest.mock.calls[0][0] as {
        messages: Array<{ type?: string; output?: string }>;
      };
      const output = request.messages.find(
        (item) => item.type === LlmMessageType.FunctionCallOutput,
      );
      expect(output?.output).toBe(JSON.stringify({ opened: true }));
    });

    it("rejects stream resume combined with input", async () => {
      const parkOnExchange = vi.fn();
      const parkLoop = new StreamLoop(streamConfig(streamParkAdapter()));
      await collect(
        parkLoop.execute("Open the jobs card", {
          onExchange: parkOnExchange,
          tools: new Toolkit([EXTERNAL_TOOL]),
          turns: 3,
        }),
      );
      const envelope = parkOnExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      const loop = new StreamLoop(streamConfig(new MockAdapter()));
      await expect(
        collect(
          loop.execute("More input", {
            resume: {
              exchange: envelope,
              results: [{ output: "ok", xid: "call-s1" }],
            },
          }),
        ),
      ).rejects.toThrow(BadRequestError);
    });
  });
});
