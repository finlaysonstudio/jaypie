import { afterEach, describe, expect, it, vi } from "vitest";

import { GoogleClient, GoogleHttpError } from "../client.js";

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

//
//
// Tests
//

describe("GoogleClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("models.generateContent", () => {
    it("POSTs to generateContent with the api-key header and REST body", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: "hi" }] } }],
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const client = new GoogleClient({ apiKey: "k" });
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "hello" }] }],
        config: {
          systemInstruction: "be brief",
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      );
      expect(init.headers["x-goog-api-key"]).toBe("k");

      const sent = JSON.parse(init.body);
      // systemInstruction (string) -> Content; generation params -> generationConfig
      expect(sent.systemInstruction).toEqual({ parts: [{ text: "be brief" }] });
      expect(sent.generationConfig).toEqual({
        temperature: 0.2,
        responseMimeType: "application/json",
      });
      expect(sent.contents).toHaveLength(1);

      // `.text` convenience getter is synthesized from candidate parts
      expect(response.text).toBe("hi");
    });

    it("throws GoogleHttpError carrying status on non-2xx", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { message: "bad key" } },
            { ok: false, status: 403 },
          ),
        );
      vi.stubGlobal("fetch", fetchMock);

      const client = new GoogleClient({ apiKey: "k" });
      await expect(
        client.models.generateContent({ model: "m", contents: [] }),
      ).rejects.toMatchObject({ status: 403, code: 403, message: "bad key" });
      await expect(
        client.models.generateContent({ model: "m", contents: [] }),
      ).rejects.toBeInstanceOf(GoogleHttpError);
    });
  });

  describe("models.generateContentStream", () => {
    it("hits streamGenerateContent?alt=sse and yields decoded chunks", async () => {
      const sse =
        'data: {"candidates":[{"content":{"parts":[{"text":"one"}]}}]}\n\n' +
        'data: {"candidates":[{"content":{"parts":[{"text":"two"}]}}],"usageMetadata":{"promptTokenCount":1}}\n\n';
      const fetchMock = vi.fn().mockResolvedValue(sseResponse(sse));
      vi.stubGlobal("fetch", fetchMock);

      const client = new GoogleClient({ apiKey: "k" });
      const stream = await client.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });

      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);

      expect(chunks).toHaveLength(2);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain(":streamGenerateContent?alt=sse");
    });
  });
});
