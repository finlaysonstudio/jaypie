import { beforeEach, describe, expect, it, vi } from "vitest";

import { EFFORT, MODEL, PROVIDER } from "../../../constants.js";
import { Toolkit } from "../../../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmMessageRole,
  LlmMessageType,
} from "../../../types/LlmProvider.interface.js";
import { LlmStreamChunkType } from "../../../types/LlmStreamChunk.interface.js";
import { ErrorCategory, OperateRequest } from "../../types.js";
import { MistralAdapter, mistralAdapter } from "../MistralAdapter.js";

//
//
// Helpers
//

function baseRequest(overrides: Partial<OperateRequest> = {}): OperateRequest {
  return {
    messages: [
      {
        content: "Hello",
        role: LlmMessageRole.User,
        type: LlmMessageType.Message,
      },
    ] as unknown as LlmHistory,
    model: MODEL.MISTRAL.LARGE,
    ...overrides,
  } as OperateRequest;
}

function textResponse(content: unknown, extra: Record<string, unknown> = {}) {
  return {
    id: "id",
    object: "chat.completion",
    created: 0,
    model: MODEL.MISTRAL.LARGE,
    choices: [
      {
        index: 0,
        finishReason: "stop",
        message: { role: "assistant", content },
      },
    ],
    ...extra,
  };
}

function toolCallResponse(name = "get_weather") {
  return {
    id: "id",
    object: "chat.completion",
    created: 0,
    model: MODEL.MISTRAL.LARGE,
    choices: [
      {
        index: 0,
        finishReason: "tool_calls",
        message: {
          role: "assistant",
          // Mistral sends an empty string, not null, alongside tool calls
          content: "",
          toolCalls: [
            {
              id: "call-1",
              type: "function",
              function: { name, arguments: '{"city":"Paris"}' },
            },
          ],
        },
      },
    ],
  };
}

/** The two-chunk content array Mistral returns when reasoning is engaged. */
const REASONING_CONTENT = [
  {
    type: "thinking",
    thinking: [{ type: "text", text: "17 times 23 is 391." }],
    closed: true,
  },
  { type: "text", text: "391" },
];

//
//
// Tests
//

describe("MistralAdapter", () => {
  let adapter: MistralAdapter;

  beforeEach(() => {
    adapter = new MistralAdapter();
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(MistralAdapter).toBeFunction();
    });

    it("exports a singleton", () => {
      expect(mistralAdapter).toBeInstanceOf(MistralAdapter);
    });

    it("names the provider and default model", () => {
      expect(adapter.name).toBe(PROVIDER.MISTRAL.NAME);
      expect(adapter.defaultModel).toBe(PROVIDER.MISTRAL.DEFAULT);
    });

    it("opts in to the structured output retry turn", () => {
      expect(adapter.supportsStructuredOutputRetry).toBe(true);
    });
  });

  describe("Error Conditions", () => {
    describe("classifyError", () => {
      it("classifies a 429 as a rate limit without retrying", () => {
        const result = adapter.classifyError({ status: 429 });
        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
        expect(result.suggestedDelayMs).toBeGreaterThan(0);
      });

      it("classifies Mistral's rate_limited type even without a status", () => {
        // The published error glossary calls this "rate_limit_error"; the wire
        // sends "rate_limited"
        const result = adapter.classifyError({ type: "rate_limited" });
        expect(result.category).toBe(ErrorCategory.RateLimit);
      });

      it("classifies a 422 schema failure as unrecoverable", () => {
        const result = adapter.classifyError({
          status: 422,
          type: "invalid_request_error",
          message: "body.user: Extra inputs are not permitted",
        });
        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies server errors as retryable", () => {
        for (const status of [408, 500, 502, 503, 524, 529]) {
          const result = adapter.classifyError({ status });
          expect(result.category).toBe(ErrorCategory.Retryable);
          expect(result.shouldRetry).toBe(true);
        }
      });

      it("classifies other 4xx as unrecoverable", () => {
        const result = adapter.classifyError({ status: 401 });
        expect(result.category).toBe(ErrorCategory.Unrecoverable);
      });

      it("classifies an unknown error as retryable", () => {
        const result = adapter.classifyError(new Error("mystery"));
        expect(result.category).toBe(ErrorCategory.Unknown);
        expect(result.shouldRetry).toBe(true);
      });
    });
  });

  describe("Happy Paths", () => {
    describe("buildRequest", () => {
      it("builds a minimal chat completions body", () => {
        const request = adapter.buildRequest(baseRequest());
        expect(request.model).toBe(MODEL.MISTRAL.LARGE);
        expect(request.messages).toHaveLength(1);
        expect(request.messages[0]).toMatchObject({ role: "user" });
      });

      it("prepends a system message", () => {
        const request = adapter.buildRequest(
          baseRequest({ system: "Be terse" }),
        );
        expect(request.messages[0]).toEqual({
          role: "system",
          content: "Be terse",
        });
      });

      it("appends instructions to the last message", () => {
        const request = adapter.buildRequest(
          baseRequest({ instructions: "Answer in French" }),
        );
        const last = request.messages[request.messages.length - 1];
        expect(last.content).toContain("Answer in French");
      });

      it("formats tools with tool_choice auto", () => {
        const request = adapter.buildRequest(
          baseRequest({
            tools: [
              {
                name: "get_weather",
                description: "Get weather",
                parameters: { type: "object", properties: {} },
              },
            ],
          }),
        );
        expect(request.tools).toEqual([
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get weather",
              parameters: { type: "object", properties: {} },
            },
          },
        ]);
        expect(request.tool_choice).toBe("auto");
      });

      it("sends native response_format for a format request", () => {
        const request = adapter.buildRequest(
          baseRequest({
            format: { type: "object", properties: { a: { type: "string" } } },
          }),
        );
        expect(request.response_format).toEqual({
          type: "json_schema",
          json_schema: {
            name: "response",
            schema: { type: "object", properties: { a: { type: "string" } } },
            strict: true,
          },
        });
      });

      it("sends response_format and tools together natively", () => {
        // Verified live: unlike Fireworks and Gemini 2.5, Mistral accepts the
        // pair, so no preemptive emulation
        const request = adapter.buildRequest(
          baseRequest({
            format: { type: "object", properties: {} },
            tools: [
              { name: "t", description: "d", parameters: { type: "object" } },
            ],
          }),
        );
        expect(request.response_format).toBeDefined();
        expect(request.tools).toHaveLength(1);
        expect(
          request.tools?.some((t) => t.function.name === "structured_output"),
        ).toBe(false);
      });

      it("passes temperature through", () => {
        const request = adapter.buildRequest(baseRequest({ temperature: 0.3 }));
        expect(
          (request as unknown as Record<string, unknown>).temperature,
        ).toBe(0.3);
      });

      it("caps non-streaming output tokens", () => {
        // An uncapped completion is a latency hazard: medium-3-5 degenerates
        // into restating its answer when format and tools are combined
        const request = adapter.buildRequest(baseRequest());
        expect(request.max_tokens).toBe(16384);
      });

      it("allows a higher cap when streaming", () => {
        const request = adapter.buildRequest(
          baseRequest({ stream: true } as Partial<OperateRequest>),
        );
        expect(request.max_tokens).toBe(32768);
      });

      it("lets providerOptions override the cap", () => {
        const request = adapter.buildRequest(
          baseRequest({ providerOptions: { max_tokens: 100 } }),
        );
        expect(request.max_tokens).toBe(100);
      });

      it("merges providerOptions", () => {
        const request = adapter.buildRequest(
          baseRequest({ providerOptions: { random_seed: 42 } }),
        );
        expect(
          (request as unknown as Record<string, unknown>).random_seed,
        ).toBe(42);
      });

      it("sets a stable prompt_cache_key when caching is enabled", () => {
        const first = adapter.buildRequest(baseRequest({ system: "Be terse" }));
        const second = adapter.buildRequest(
          baseRequest({ system: "Be terse" }),
        );
        expect(first.prompt_cache_key).toBeString();
        expect(first.prompt_cache_key).toBe(second.prompt_cache_key);
      });

      it("omits prompt_cache_key when caching is disabled", () => {
        const request = adapter.buildRequest(baseRequest({ cache: false }));
        expect(request.prompt_cache_key).toBeUndefined();
      });

      it("never sends a user field", () => {
        // Mistral rejects unknown fields with a 422 extra_forbidden, and it
        // has no `user` — forwarding it fails every request
        const request = adapter.buildRequest(
          baseRequest({ user: "user-123" } as Partial<OperateRequest>),
        );
        expect(
          (request as unknown as Record<string, unknown>).user,
        ).toBeUndefined();
        expect(Object.keys(request)).not.toContain("user");
      });
    });

    describe("Effort", () => {
      it("maps high to Mistral's high without papering", () => {
        const request = adapter.buildRequest(
          baseRequest({ effort: EFFORT.HIGH, model: MODEL.MISTRAL.SMALL }),
        );
        expect(request.reasoning_effort).toBe("high");
      });

      it("maps the floor to none", () => {
        const request = adapter.buildRequest(
          baseRequest({ effort: EFFORT.LOWEST, model: MODEL.MISTRAL.SMALL }),
        );
        expect(request.reasoning_effort).toBe("none");
      });

      it("collapses the middle rungs onto high", () => {
        for (const effort of [EFFORT.LOW, EFFORT.MEDIUM, EFFORT.HIGHEST]) {
          const request = adapter.buildRequest(
            baseRequest({ effort, model: MODEL.MISTRAL.SMALL }),
          );
          expect(request.reasoning_effort).toBe("high");
        }
      });

      it("omits effort for models that do not reason", () => {
        // Large 3 answers "reasoning_effort is not enabled for this model"
        const request = adapter.buildRequest(
          baseRequest({ effort: EFFORT.HIGH, model: MODEL.MISTRAL.LARGE }),
        );
        expect(request.reasoning_effort).toBeUndefined();
      });

      it("omits effort once a model is cached as rejecting it", () => {
        adapter.rememberModelRejectsReasoningEffort(MODEL.MISTRAL.SMALL);
        const request = adapter.buildRequest(
          baseRequest({ effort: EFFORT.HIGH, model: MODEL.MISTRAL.SMALL }),
        );
        expect(request.reasoning_effort).toBeUndefined();
        adapter.clearRuntimeNoReasoningEffortModels();
      });
    });

    describe("Content Conversion", () => {
      it("carries images as image_url parts", () => {
        const request = adapter.buildRequest(
          baseRequest({
            messages: [
              {
                role: LlmMessageRole.User,
                content: [
                  {
                    type: LlmMessageType.InputImage,
                    image_url: "data:image/png;base64,AAAA",
                  },
                ],
              },
            ] as unknown as LlmHistory,
          }),
        );
        expect(request.messages[0].content).toEqual([
          {
            type: "image_url",
            imageUrl: { url: "data:image/png;base64,AAAA" },
          },
        ]);
      });

      it("carries files as document_url parts", () => {
        // Mistral accepts a base64 data URI on document_url directly, which is
        // what resolveOperateInput already produces
        const request = adapter.buildRequest(
          baseRequest({
            messages: [
              {
                role: LlmMessageRole.User,
                content: [
                  {
                    type: LlmMessageType.InputFile,
                    file_data: "data:application/pdf;base64,AAAA",
                    filename: "page.pdf",
                  },
                ],
              },
            ] as unknown as LlmHistory,
          }),
        );
        expect(request.messages[0].content).toEqual([
          {
            type: "document_url",
            documentUrl: "data:application/pdf;base64,AAAA",
            documentName: "page.pdf",
          },
        ]);
      });

      it("discards a file with no data", () => {
        const request = adapter.buildRequest(
          baseRequest({
            messages: [
              {
                role: LlmMessageRole.User,
                content: [
                  { type: LlmMessageType.InputFile, filename: "empty.pdf" },
                ],
              },
            ] as unknown as LlmHistory,
          }),
        );
        expect(request.messages[0].content).toBe("");
      });
    });

    describe("parseResponse", () => {
      it("returns string content unchanged", () => {
        const parsed = adapter.parseResponse(textResponse("Hello there"));
        expect(parsed.content).toBe("Hello there");
        expect(parsed.hasToolCalls).toBe(false);
        expect(parsed.stopReason).toBe("stop");
      });

      it("returns only the text chunk from reasoning content", () => {
        const parsed = adapter.parseResponse(textResponse(REASONING_CONTENT));
        expect(parsed.content).toBe("391");
      });

      it("detects tool calls", () => {
        const parsed = adapter.parseResponse(toolCallResponse());
        expect(parsed.hasToolCalls).toBe(true);
        expect(parsed.stopReason).toBe("tool_calls");
      });
    });

    describe("extractToolCalls", () => {
      it("maps tool calls to the standard shape", () => {
        const calls = adapter.extractToolCalls(toolCallResponse());
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({
          callId: "call-1",
          name: "get_weather",
          arguments: '{"city":"Paris"}',
        });
      });

      it("returns an empty array with no tool calls", () => {
        expect(adapter.extractToolCalls(textResponse("hi"))).toEqual([]);
      });
    });

    describe("extractUsage", () => {
      it("reads camelCase and snake_case token counts", () => {
        const usage = adapter.extractUsage(
          textResponse("hi", {
            usage: {
              prompt_tokens: 10,
              completion_tokens: 4,
              total_tokens: 14,
            },
          }),
          MODEL.MISTRAL.LARGE,
        );
        expect(usage).toMatchObject({
          input: 10,
          output: 4,
          total: 14,
          provider: PROVIDER.MISTRAL.NAME,
          model: MODEL.MISTRAL.LARGE,
        });
      });

      it("surfaces cached prompt tokens as cacheRead", () => {
        const usage = adapter.extractUsage(
          textResponse("hi", {
            usage: {
              prompt_tokens: 100,
              completion_tokens: 4,
              total_tokens: 104,
              prompt_tokens_details: { cached_tokens: 64 },
            },
          }),
          MODEL.MISTRAL.LARGE,
        );
        expect(usage.cacheRead).toBe(64);
      });

      it("returns zeros when usage is absent", () => {
        const usage = adapter.extractUsage(
          textResponse("hi"),
          MODEL.MISTRAL.LARGE,
        );
        expect(usage).toMatchObject({ input: 0, output: 0, total: 0 });
      });
    });

    describe("responseToHistoryItems", () => {
      it("returns an assistant message for text", () => {
        const items = adapter.responseToHistoryItems(textResponse("Hello"));
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
          content: "Hello",
          role: LlmMessageRole.Assistant,
          type: LlmMessageType.Message,
        });
      });

      it("preserves thinking text as reasoning", () => {
        const items = adapter.responseToHistoryItems(
          textResponse(REASONING_CONTENT),
        );
        expect(items[0]).toMatchObject({
          content: "391",
          reasoning: "17 times 23 is 391.",
        });
      });

      it("defers tool-call responses to appendToolResult", () => {
        expect(adapter.responseToHistoryItems(toolCallResponse())).toEqual([]);
      });
    });

    describe("Tool results", () => {
      it("formats a tool result message", () => {
        const result = adapter.formatToolResult(
          { callId: "call-1", name: "t", arguments: "{}", raw: {} },
          { output: "sunny" } as never,
        );
        expect(result).toEqual({
          role: "tool",
          toolCallId: "call-1",
          content: "sunny",
        });
      });

      it("appends the assistant call and the tool result", () => {
        const request = adapter.buildRequest(baseRequest());
        const before = request.messages.length;
        adapter.appendToolResult(
          request,
          {
            callId: "call-1",
            name: "t",
            arguments: "{}",
            raw: { id: "call-1", type: "function", function: {} },
          },
          { output: "sunny" } as never,
        );
        expect(request.messages).toHaveLength(before + 2);
        expect(request.messages[before].role).toBe("assistant");
        expect(request.messages[before + 1].role).toBe("tool");
      });
    });

    describe("isComplete", () => {
      it("is complete with no tool calls", () => {
        expect(adapter.isComplete(textResponse("done"))).toBe(true);
      });

      it("is incomplete with tool calls", () => {
        expect(adapter.isComplete(toolCallResponse())).toBe(false);
      });
    });

    describe("Structured output", () => {
      it("extracts JSON from an annotated native response", () => {
        const response = {
          ...textResponse('{"capital":"Paris"}'),
          __jaypieStructuredOutput: true,
        };
        expect(adapter.hasStructuredOutput(response)).toBe(true);
        expect(adapter.extractStructuredOutput(response)).toEqual({
          capital: "Paris",
        });
      });

      it("extracts JSON from the text chunk when reasoning is also on", () => {
        const response = {
          ...textResponse([
            {
              type: "thinking",
              thinking: [{ type: "text", text: "considering" }],
            },
            { type: "text", text: '{"capital":"Paris"}' },
          ]),
          __jaypieStructuredOutput: true,
        };
        expect(adapter.extractStructuredOutput(response)).toEqual({
          capital: "Paris",
        });
      });

      it("returns undefined for unparsable native content", () => {
        const response = {
          ...textResponse("not json"),
          __jaypieStructuredOutput: true,
        };
        expect(adapter.extractStructuredOutput(response)).toBeUndefined();
        expect(adapter.hasStructuredOutput(response)).toBe(false);
      });

      it("reads the structured_output tool call on the emulation path", () => {
        const response = toolCallResponse("structured_output");
        expect(adapter.hasStructuredOutput(response)).toBe(true);
        expect(adapter.extractStructuredOutput(response)).toEqual({
          city: "Paris",
        });
      });

      it("engages emulation for a model cached as rejecting response_format", () => {
        adapter.rememberModelRejectsStructuredOutput(MODEL.MISTRAL.LARGE);
        const request = adapter.buildRequest(
          baseRequest({ format: { type: "object", properties: {} } }),
        );
        expect(request.response_format).toBeUndefined();
        expect(
          request.tools?.some((t) => t.function.name === "structured_output"),
        ).toBe(true);
        adapter.clearRuntimeNoStructuredOutputModels();
      });
    });

    describe("formatOutputSchema", () => {
      it("forces additionalProperties false on every object", () => {
        const schema = adapter.formatOutputSchema({
          type: "object",
          properties: {
            nested: { type: "object", properties: { a: { type: "string" } } },
          },
        });
        expect(schema.additionalProperties).toBe(false);
        expect(
          (schema.properties as Record<string, Record<string, unknown>>).nested
            .additionalProperties,
        ).toBe(false);
      });

      it("converts a natural schema", () => {
        const schema = adapter.formatOutputSchema({ capital: String });
        expect(schema.type).toBe("object");
        expect(schema.properties).toHaveProperty("capital");
        expect(schema.$schema).toBeUndefined();
      });
    });

    describe("formatTools", () => {
      it("maps a Toolkit to provider tool definitions", () => {
        const toolkit = new Toolkit([
          {
            name: "roll",
            description: "Roll dice",
            type: "function",
            parameters: { type: "object", properties: {} },
            call: async () => 4,
          },
        ]);
        expect(adapter.formatTools(toolkit)).toEqual([
          {
            name: "roll",
            description: "Roll dice",
            parameters: { type: "object", properties: {} },
          },
        ]);
      });
    });

    describe("executeRequest", () => {
      it("annotates the response when structured output was requested", async () => {
        const client = {
          chatCompletion: vi.fn().mockResolvedValue(textResponse('{"a":1}')),
        };
        const request = adapter.buildRequest(
          baseRequest({ format: { type: "object", properties: {} } }),
        );
        const response = (await adapter.executeRequest(
          client,
          request,
        )) as unknown as Record<string, unknown>;
        expect(response.__jaypieStructuredOutput).toBe(true);
      });

      it("retries without reasoning_effort when the model rejects it", async () => {
        const chatCompletion = vi
          .fn()
          .mockRejectedValueOnce(
            Object.assign(
              new Error("reasoning_effort is not enabled for this model"),
              { status: 400, code: "3051" },
            ),
          )
          .mockResolvedValueOnce(textResponse("ok"));
        const client = { chatCompletion };

        const request = adapter.buildRequest(
          baseRequest({ effort: EFFORT.HIGH, model: MODEL.MISTRAL.SMALL }),
        );
        const response = await adapter.executeRequest(client, request);

        expect(chatCompletion).toHaveBeenCalledTimes(2);
        expect(
          chatCompletion.mock.calls[1][0].reasoning_effort,
        ).toBeUndefined();
        expect(adapter.parseResponse(response).content).toBe("ok");
        adapter.clearRuntimeNoReasoningEffortModels();
      });

      it("falls back to tool emulation when response_format is rejected", async () => {
        const chatCompletion = vi
          .fn()
          .mockRejectedValueOnce(
            Object.assign(new Error("response_format is not supported"), {
              status: 400,
            }),
          )
          .mockResolvedValueOnce(toolCallResponse("structured_output"));
        const client = { chatCompletion };

        const request = adapter.buildRequest(
          baseRequest({ format: { type: "object", properties: {} } }),
        );
        await adapter.executeRequest(client, request);

        expect(chatCompletion).toHaveBeenCalledTimes(2);
        const retryBody = chatCompletion.mock.calls[1][0];
        expect(retryBody.response_format).toBeUndefined();
        expect(
          retryBody.tools.some(
            (t: { function: { name: string } }) =>
              t.function.name === "structured_output",
          ),
        ).toBe(true);
        adapter.clearRuntimeNoStructuredOutputModels();
      });

      it("rethrows an unrelated error", async () => {
        const client = {
          chatCompletion: vi
            .fn()
            .mockRejectedValue(
              Object.assign(new Error("boom"), { status: 500 }),
            ),
        };
        const request = adapter.buildRequest(baseRequest());
        await expect(adapter.executeRequest(client, request)).rejects.toThrow(
          "boom",
        );
      });
    });

    describe("executeStreamRequest", () => {
      it("yields text chunks and a done chunk with usage", async () => {
        async function* fakeStream() {
          yield { choices: [{ delta: { content: "Hel" } }] };
          yield { choices: [{ delta: { content: "lo" } }] };
          yield { usage: { prompt_tokens: 5, completion_tokens: 2 } };
        }
        const client = { streamChatCompletion: () => fakeStream() };
        const request = adapter.buildRequest(baseRequest());

        const chunks = [];
        for await (const chunk of adapter.executeStreamRequest(
          client,
          request,
        )) {
          chunks.push(chunk);
        }

        const text = chunks
          .filter((c) => c.type === LlmStreamChunkType.Text)
          .map((c) => (c as { content: string }).content)
          .join("");
        expect(text).toBe("Hello");

        const done = chunks.find((c) => c.type === LlmStreamChunkType.Done) as {
          usage: Array<{ input: number; output: number }>;
        };
        expect(done.usage[0]).toMatchObject({ input: 5, output: 2 });
      });

      it("keeps reasoning deltas out of the text stream", async () => {
        async function* fakeStream() {
          yield {
            choices: [
              {
                delta: {
                  content: [
                    {
                      type: "thinking",
                      thinking: [{ type: "text", text: "hm" }],
                    },
                  ],
                },
              },
            ],
          };
          yield {
            choices: [{ delta: { content: [{ type: "text", text: "391" }] } }],
          };
        }
        const client = { streamChatCompletion: () => fakeStream() };
        const request = adapter.buildRequest(baseRequest());

        const text: string[] = [];
        for await (const chunk of adapter.executeStreamRequest(
          client,
          request,
        )) {
          if (chunk.type === LlmStreamChunkType.Text) {
            text.push((chunk as { content: string }).content);
          }
        }
        expect(text.join("")).toBe("391");
      });

      it("emits a tool call chunk", async () => {
        async function* fakeStream() {
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      id: "call-1",
                      function: { name: "roll", arguments: '{"n":2}' },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          };
        }
        const client = { streamChatCompletion: () => fakeStream() };
        const request = adapter.buildRequest(baseRequest());

        const calls = [];
        for await (const chunk of adapter.executeStreamRequest(
          client,
          request,
        )) {
          if (chunk.type === LlmStreamChunkType.ToolCall) calls.push(chunk);
        }
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({
          toolCall: { id: "call-1", name: "roll", arguments: '{"n":2}' },
        });
      });
    });
  });
});
