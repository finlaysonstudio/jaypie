import { afterEach, describe, expect, it, vi } from "vitest";

import { MistralClient, MistralHttpError } from "../client.js";

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

describe("MistralClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Base Cases", () => {
    it("is a class", () => {
      expect(MistralClient).toBeTypeOf("function");
    });
  });

  describe("chatCompletion", () => {
    it("POSTs to the chat completions endpoint with bearer auth", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ choices: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const client = new MistralClient({ apiKey: "ml-test" });
      await client.chatCompletion({ model: "m", messages: [] });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer ml-test");
      expect(JSON.parse(init.body)).toEqual({ model: "m", messages: [] });
    });

    it("Honors a custom baseURL", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ choices: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const client = new MistralClient({
        apiKey: "ml-test",
        baseURL: "https://example.test/v1",
      });
      await client.chatCompletion({ model: "m", messages: [] });

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://example.test/v1/chat/completions",
      );
    });

    it("Normalizes snake_case protocol fields to camelCase", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                tool_calls: [{ id: "abc" }],
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 4,
            total_tokens: 14,
            prompt_tokens_details: { cached_tokens: 6 },
          },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = new MistralClient({ apiKey: "ml-test" });
      const response = (await client.chatCompletion({
        model: "m",
        messages: [],
      })) as Record<string, never>;

      const choice = (
        response.choices as unknown as Array<Record<string, unknown>>
      )[0];
      expect(choice.finishReason).toBe("tool_calls");
      expect(
        (choice.message as Record<string, unknown>).toolCalls,
      ).toBeDefined();

      const usage = response.usage as unknown as Record<string, unknown>;
      expect(usage.promptTokens).toBe(10);
      expect(usage.completionTokens).toBe(4);
      expect(usage.totalTokens).toBe(14);
      expect(usage.promptTokensDetails).toEqual({ cachedTokens: 6 });
    });

    it("Leaves array-shaped content untouched", async () => {
      // Reasoning responses return content as chunks; the client must not
      // flatten them, so the adapter can split answer from thinking
      const content = [
        { type: "thinking", thinking: [{ type: "text", text: "hmm" }] },
        { type: "text", text: "391" },
      ];
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          choices: [{ message: { role: "assistant", content } }],
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = new MistralClient({ apiKey: "ml-test" });
      const response = (await client.chatCompletion({
        model: "m",
        messages: [],
      })) as Record<string, never>;

      const choice = (
        response.choices as unknown as Array<Record<string, unknown>>
      )[0];
      expect((choice.message as Record<string, unknown>).content).toEqual(
        content,
      );
    });
  });

  describe("Error handling", () => {
    it("Throws MistralHttpError carrying status, type, and code", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(
            {
              object: "error",
              message: "Rate limit exceeded",
              type: "rate_limited",
              code: "1300",
            },
            { ok: false, status: 429 },
          ),
        ),
      );

      const client = new MistralClient({ apiKey: "ml-test" });
      await expect(
        client.chatCompletion({ model: "m", messages: [] }),
      ).rejects.toThrow(MistralHttpError);

      try {
        await client.chatCompletion({ model: "m", messages: [] });
      } catch (error) {
        const httpError = error as MistralHttpError;
        expect(httpError.status).toBe(429);
        expect(httpError.statusCode).toBe(429);
        expect(httpError.message).toBe("Rate limit exceeded");
        expect(httpError.type).toBe("rate_limited");
        expect(httpError.code).toBe("1300");
        // Mirrored for the shared classifyProviderError pass
        expect(httpError.error?.message).toBe("Rate limit exceeded");
      }
    });

    it("Renders the object-shaped message from a 422 schema failure", async () => {
      // Mistral's `message` is polymorphic: a string on model errors, an
      // object of field-level failures on schema validation. Stringifying the
      // latter blindly yields "[object Object]" and loses the field names.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(
            {
              object: "error",
              message: {
                detail: [
                  {
                    type: "extra_forbidden",
                    loc: ["body", "user"],
                    msg: "Extra inputs are not permitted",
                  },
                  {
                    type: "extra_forbidden",
                    loc: ["body", "seed"],
                    msg: "Extra inputs are not permitted",
                  },
                ],
              },
              type: "invalid_request_error",
            },
            { ok: false, status: 422 },
          ),
        ),
      );

      const client = new MistralClient({ apiKey: "ml-test" });
      try {
        await client.chatCompletion({ model: "m", messages: [] });
        expect.unreachable("should have thrown");
      } catch (error) {
        const httpError = error as MistralHttpError;
        expect(httpError.status).toBe(422);
        expect(httpError.message).toBe(
          "body.user: Extra inputs are not permitted; body.seed: Extra inputs are not permitted",
        );
        expect(httpError.message).not.toContain("[object Object]");
      }
    });

    it("Falls back to a status message on a non-JSON body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => {
            throw new Error("not json");
          },
        } as unknown as Response),
      );

      const client = new MistralClient({ apiKey: "ml-test" });
      await expect(
        client.chatCompletion({ model: "m", messages: [] }),
      ).rejects.toThrow("Mistral request failed with status 502");
    });
  });

  describe("streamChatCompletion", () => {
    it("Requests streaming with usage and yields decoded chunks", async () => {
      const sse = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}',
        "",
        'data: {"choices":[{"delta":{"content":" there"}}],"usage":{"prompt_tokens":3,"completion_tokens":2}}',
        "",
        "data: [DONE]",
        "",
        "",
      ].join("\n");
      const fetchMock = vi.fn().mockResolvedValue(sseResponse(sse));
      vi.stubGlobal("fetch", fetchMock);

      const client = new MistralClient({ apiKey: "ml-test" });
      const chunks = [];
      for await (const chunk of client.streamChatCompletion({
        model: "m",
        messages: [],
      })) {
        chunks.push(chunk);
      }

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.stream).toBe(true);
      expect(body.stream_options).toEqual({ include_usage: true });
      expect(chunks).toHaveLength(2);
    });

    it("Throws before streaming when the response is not ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(
            {
              object: "error",
              message: "nope",
              type: "invalid_request_error",
            },
            { ok: false, status: 400 },
          ),
        ),
      );

      const client = new MistralClient({ apiKey: "ml-test" });
      const iterate = async () => {
        for await (const _chunk of client.streamChatCompletion({
          model: "m",
          messages: [],
        })) {
          // drain
        }
      };
      await expect(iterate()).rejects.toThrow("nope");
    });
  });

  describe("ocr", () => {
    it("POSTs the document to the OCR endpoint with the default model", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          model: "mistral-ocr-4-0",
          pages: [{ index: 0, markdown: "# Mock Page" }],
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = new MistralClient({ apiKey: "ml-test" });
      const result = await client.ocr({
        document: {
          type: "document_url",
          document_url: "data:application/pdf;base64,AAAA",
        },
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.mistral.ai/v1/ocr");
      const body = JSON.parse(init.body);
      expect(body.model).toBe("mistral-ocr-4-0");
      expect(body.document.type).toBe("document_url");
      expect(body.pages).toBeUndefined();
      expect(result.pages).toBeDefined();
    });

    it("Forwards an explicit page selection", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ pages: [] }));
      vi.stubGlobal("fetch", fetchMock);

      const client = new MistralClient({ apiKey: "ml-test" });
      await client.ocr({
        document: {
          type: "document_url",
          document_url: "https://x.test/a.pdf",
        },
        model: "mistral-ocr-2512",
        pages: [0, 2],
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.model).toBe("mistral-ocr-2512");
      expect(body.pages).toEqual([0, 2]);
    });
  });
});
