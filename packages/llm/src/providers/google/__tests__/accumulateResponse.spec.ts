import { describe, expect, it, vi } from "vitest";

import { accumulateGoogleResponse } from "../accumulateResponse.js";
import { GeminiRawResponse } from "../types.js";

//
//
// Helpers
//

async function* streamOf(chunks: unknown[]): AsyncIterable<GeminiRawResponse> {
  for (const chunk of chunks) {
    yield chunk as GeminiRawResponse;
  }
}

//
//
// Run tests
//

describe("accumulateGoogleResponse", () => {
  it("concatenates text parts and keeps the last finish reason and usage", async () => {
    const response = await accumulateGoogleResponse(
      streamOf([
        {
          candidates: [
            { content: { parts: [{ text: "Hello, " }], role: "model" } },
          ],
          modelVersion: "gemini-3.1-pro",
          responseId: "r1",
          usageMetadata: { promptTokenCount: 4 },
        },
        {
          candidates: [
            {
              content: { parts: [{ text: "world" }], role: "model" },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            candidatesTokenCount: 2,
            promptTokenCount: 4,
            totalTokenCount: 6,
          },
        },
      ]),
    );

    expect(response).toEqual({
      candidates: [
        {
          content: { parts: [{ text: "Hello, world" }], role: "model" },
          finishReason: "STOP",
          index: 0,
        },
      ],
      modelVersion: "gemini-3.1-pro",
      responseId: "r1",
      text: "Hello, world",
      usageMetadata: {
        candidatesTokenCount: 2,
        promptTokenCount: 4,
        totalTokenCount: 6,
      },
    });
  });

  it("keeps thought parts apart from answer text and attaches a trailing signature", async () => {
    const response = await accumulateGoogleResponse(
      streamOf([
        {
          candidates: [
            {
              content: {
                parts: [{ text: "Hmm ", thought: true }],
                role: "model",
              },
            },
          ],
        },
        {
          candidates: [
            {
              content: {
                parts: [{ text: "ok", thought: true }],
                role: "model",
              },
            },
          ],
        },
        {
          candidates: [
            { content: { parts: [{ text: "Answer" }], role: "model" } },
          ],
        },
        {
          candidates: [
            {
              content: {
                parts: [{ text: "", thoughtSignature: "sig" }],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
        },
      ]),
    );

    expect(response.candidates?.[0].content?.parts).toEqual([
      { text: "Hmm ok", thought: true },
      { text: "Answer", thoughtSignature: "sig" },
    ]);
    expect(response.text).toBe("Answer");
  });

  it("keeps function call parts with their thought signatures", async () => {
    const response = await accumulateGoogleResponse(
      streamOf([
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      args: { city: "NYC" },
                      name: "get_weather",
                    },
                    thoughtSignature: "sig-1",
                  },
                ],
                role: "model",
              },
            },
          ],
        },
        {
          candidates: [
            {
              content: {
                parts: [{ functionCall: { args: {}, name: "get_time" } }],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
        },
      ]),
    );

    expect(response.candidates?.[0].content?.parts).toEqual([
      {
        functionCall: { args: { city: "NYC" }, name: "get_weather" },
        thoughtSignature: "sig-1",
      },
      { functionCall: { args: {}, name: "get_time" } },
    ]);
    expect(response.text).toBeUndefined();
  });

  it("does not merge text onto a part that already carries a signature", async () => {
    const response = await accumulateGoogleResponse(
      streamOf([
        {
          candidates: [
            {
              content: {
                parts: [{ text: "a", thoughtSignature: "s1" }],
                role: "model",
              },
            },
          ],
        },
        {
          candidates: [{ content: { parts: [{ text: "b" }], role: "model" } }],
        },
      ]),
    );

    expect(response.candidates?.[0].content?.parts).toEqual([
      { text: "a", thoughtSignature: "s1" },
      { text: "b" },
    ]);
  });

  it("reports MAX_TOKENS and prompt feedback", async () => {
    const response = await accumulateGoogleResponse(
      streamOf([
        { promptFeedback: { blockReason: "SAFETY" } },
        {
          candidates: [
            {
              content: { parts: [{ text: "cut" }], role: "model" },
              finishReason: "MAX_TOKENS",
            },
          ],
        },
      ]),
    );

    expect(response.promptFeedback).toEqual({ blockReason: "SAFETY" });
    expect(response.candidates?.[0].finishReason).toBe("MAX_TOKENS");
  });

  it("calls onActivity for every chunk", async () => {
    const onActivity = vi.fn();
    await accumulateGoogleResponse(streamOf([{}, {}, {}]), { onActivity });

    expect(onActivity).toHaveBeenCalledTimes(3);
  });

  it("throws a status-typed error for an error chunk", async () => {
    await expect(
      accumulateGoogleResponse(
        streamOf([
          {
            error: { code: 503, message: "Overloaded", status: "UNAVAILABLE" },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      message: "Overloaded",
      name: "GoogleHttpError",
      status: 503,
    });
  });

  it("throws when the stream is empty", async () => {
    await expect(accumulateGoogleResponse(streamOf([]))).rejects.toMatchObject({
      status: 500,
    });
  });
});
