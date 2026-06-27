import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenRouterClient, OpenRouterHttpError } from "../client.js";

//
//
// Helpers
//

function jsonResponse(
  body: unknown,
  { ok = true, status = 200 } = {},
): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Build a Response whose body streams the given SSE text in arbitrary slices. */
function sseResponse(text: string, sliceAt: number[] = []): Response {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const bounds = [0, ...sliceAt, bytes.length];
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= bounds.length - 1) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(bounds[index], bounds[index + 1]));
      index += 1;
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

//
//
// Tests
//

describe("OpenRouterClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Base Cases", () => {
    it("is a class", () => {
      expect(OpenRouterClient).toBeTypeOf("function");
    });
  });

  describe("chatCompletion", () => {
    it("POSTs to the chat completions endpoint with bearer auth", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ choices: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const client = new OpenRouterClient({ apiKey: "sk-test" });
      await client.chatCompletion({ model: "m", messages: [] });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer sk-test");
      expect(JSON.parse(init.body)).toEqual({ model: "m", messages: [] });
    });

    it("normalizes snake_case wire fields to camelCase", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "c1",
                    type: "function",
                    function: { name: "t", arguments: "{}" },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = new OpenRouterClient({ apiKey: "sk-test" });
      const response = (await client.chatCompletion({
        model: "m",
        messages: [],
      })) as {
        choices: Array<{
          message: { toolCalls: unknown[] };
          finishReason: string;
        }>;
        usage: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
      };

      expect(response.choices[0].message.toolCalls).toHaveLength(1);
      expect(response.choices[0].finishReason).toBe("tool_calls");
      expect(response.usage.promptTokens).toBe(3);
      expect(response.usage.completionTokens).toBe(5);
      expect(response.usage.totalTokens).toBe(8);
    });

    it("throws OpenRouterHttpError carrying status and message on non-2xx", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { message: "rate limited" } },
            { ok: false, status: 429 },
          ),
        );
      vi.stubGlobal("fetch", fetchMock);

      const client = new OpenRouterClient({ apiKey: "sk-test" });
      await expect(
        client.chatCompletion({ model: "m", messages: [] }),
      ).rejects.toMatchObject({
        status: 429,
        statusCode: 429,
        message: "rate limited",
      });
      await expect(
        client.chatCompletion({ model: "m", messages: [] }),
      ).rejects.toBeInstanceOf(OpenRouterHttpError);
    });
  });

  describe("streamChatCompletion", () => {
    it("requests usage and yields decoded SSE chunks until [DONE]", async () => {
      const sse =
        'data: {"choices":[{"delta":{"content":"He"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n' +
        'data: {"usage":{"prompt_tokens":1,"completion_tokens":2}}\n\n' +
        "data: [DONE]\n\n";
      // Split mid-chunk to exercise cross-read buffering.
      const fetchMock = vi.fn().mockResolvedValue(sseResponse(sse, [20, 55]));
      vi.stubGlobal("fetch", fetchMock);

      const client = new OpenRouterClient({ apiKey: "sk-test" });
      const chunks: unknown[] = [];
      for await (const chunk of client.streamChatCompletion({
        model: "m",
        messages: [],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      const init = fetchMock.mock.calls[0][1];
      const sentBody = JSON.parse(init.body);
      expect(sentBody.stream).toBe(true);
      expect(sentBody.stream_options).toEqual({ include_usage: true });
    });
  });
});
