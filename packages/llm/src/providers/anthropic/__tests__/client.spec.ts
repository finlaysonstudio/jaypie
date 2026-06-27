import { afterEach, describe, expect, it, vi } from "vitest";

import { AnthropicClient, RateLimitError } from "../client.js";

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

function sseResponse(text: string): Response {
  const bytes = new TextEncoder().encode(text);
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) {
        controller.close();
        return;
      }
      controller.enqueue(bytes);
      sent = true;
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

const BASE_PARAMS = {
  model: "claude-haiku-4-5",
  max_tokens: 64,
  messages: [{ role: "user" as const, content: "hi" }],
};

//
//
// Tests
//

describe("AnthropicClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("messages.create (non-streaming)", () => {
    it("POSTs to /messages with x-api-key and version headers", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = new AnthropicClient({ apiKey: "sk-ant" });
      await client.messages.create(BASE_PARAMS);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(init.headers["x-api-key"]).toBe("sk-ant");
      expect(init.headers["anthropic-version"]).toBe("2023-06-01");
      // Internal params are already wire-shaped: serialized verbatim
      expect(JSON.parse(init.body)).toMatchObject({
        model: "claude-haiku-4-5",
      });
    });

    it("throws a status-named error (RateLimitError for 429) so classifyError works", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { message: "slow down" } },
            { ok: false, status: 429 },
          ),
        );
      vi.stubGlobal("fetch", fetchMock);

      const client = new AnthropicClient({ apiKey: "sk-ant" });
      const error = await client.messages.create(BASE_PARAMS).catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.constructor.name).toBe("RateLimitError");
      expect(error.status).toBe(429);
      expect(error.message).toBe("slow down");
    });
  });

  describe("messages.create (streaming)", () => {
    it("returns an async iterable of decoded SSE events", async () => {
      const sse =
        'event: message_start\ndata: {"type":"message_start","message":{"model":"m","usage":{"input_tokens":1,"output_tokens":0}}}\n\n' +
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n' +
        'event: message_stop\ndata: {"type":"message_stop"}\n\n';
      const fetchMock = vi.fn().mockResolvedValue(sseResponse(sse));
      vi.stubGlobal("fetch", fetchMock);

      const client = new AnthropicClient({ apiKey: "sk-ant" });
      const stream = await client.messages.create({
        ...BASE_PARAMS,
        stream: true,
      });

      const events = [];
      for await (const event of stream) events.push(event);

      expect(events.map((e) => e.type)).toEqual([
        "message_start",
        "content_block_delta",
        "message_stop",
      ]);
      const init = fetchMock.mock.calls[0][1];
      expect(init.headers.accept).toBe("text/event-stream");
    });
  });
});
