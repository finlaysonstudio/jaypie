import { JsonObject } from "@jaypie/types";
import { describe, expect, it, vi } from "vitest";

import { accumulateMistralCompletion } from "../accumulateCompletion.js";

//
//
// Helpers
//

async function* streamOf(chunks: unknown[]): AsyncIterable<JsonObject> {
  for (const chunk of chunks) {
    yield chunk as JsonObject;
  }
}

const USAGE = {
  completion_tokens: 7,
  prompt_tokens: 11,
  prompt_tokens_details: { cached_tokens: 3 },
  total_tokens: 18,
};

//
//
// Run tests
//

describe("accumulateMistralCompletion", () => {
  it("concatenates text content and normalizes like a non-streaming completion", async () => {
    const completion = await accumulateMistralCompletion(
      streamOf([
        {
          choices: [{ delta: { content: "", role: "assistant" }, index: 0 }],
          created: 1,
          id: "cmpl-1",
          model: "mistral-small-latest",
        },
        { choices: [{ delta: { content: "Hello, " }, index: 0 }] },
        {
          choices: [
            { delta: { content: "world" }, finish_reason: "stop", index: 0 },
          ],
        },
        { choices: [], usage: USAGE },
      ]),
    );

    expect(completion).toEqual({
      choices: [
        {
          finishReason: "stop",
          finish_reason: "stop",
          index: 0,
          message: { content: "Hello, world", role: "assistant" },
        },
      ],
      created: 1,
      id: "cmpl-1",
      model: "mistral-small-latest",
      object: "chat.completion",
      usage: {
        ...USAGE,
        completionTokens: 7,
        promptTokens: 11,
        promptTokensDetails: { cachedTokens: 3 },
        totalTokens: 18,
      },
    });
  });

  it("merges tool call deltas by index with concatenated arguments", async () => {
    const completion = await accumulateMistralCompletion(
      streamOf([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    function: { arguments: "", name: "get_weather" },
                    id: "a",
                    index: 0,
                  },
                  {
                    function: { arguments: "{}", name: "get_time" },
                    id: "b",
                    index: 1,
                  },
                ],
              },
              index: 0,
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { function: { arguments: '{"city":"NYC"}' }, index: 0 },
                ],
              },
              finish_reason: "tool_calls",
              index: 0,
            },
          ],
        },
      ]),
    );

    const choice = (completion.choices as JsonObject[])[0];
    const message = choice.message as JsonObject;
    expect(choice.finishReason).toBe("tool_calls");
    expect(message.content).toBeNull();
    expect(message.toolCalls).toEqual([
      {
        function: { arguments: '{"city":"NYC"}', name: "get_weather" },
        id: "a",
        type: "function",
      },
      {
        function: { arguments: "{}", name: "get_time" },
        id: "b",
        type: "function",
      },
    ]);
  });

  it("matches index-less tool call deltas by id", async () => {
    const completion = await accumulateMistralCompletion(
      streamOf([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { function: { arguments: '{"a":', name: "x" }, id: "a" },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [{ function: { arguments: "1}" }, id: "a" }],
              },
              finish_reason: "tool_calls",
            },
          ],
        },
      ]),
    );

    const message = (completion.choices as JsonObject[])[0]
      .message as JsonObject;
    expect(message.toolCalls).toEqual([
      {
        function: { arguments: '{"a":1}', name: "x" },
        id: "a",
        type: "function",
      },
    ]);
  });

  it("keeps reasoning as thinking chunks ahead of the answer text", async () => {
    const completion = await accumulateMistralCompletion(
      streamOf([
        {
          choices: [
            {
              delta: {
                content: [
                  {
                    thinking: [{ text: "Let ", type: "text" }],
                    type: "thinking",
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                content: [
                  {
                    closed: true,
                    thinking: [{ text: "me think", type: "text" }],
                    type: "thinking",
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [{ delta: { content: [{ text: "Answer", type: "text" }] } }],
        },
        { choices: [{ delta: { content: " here" }, finish_reason: "stop" }] },
      ]),
    );

    const message = (completion.choices as JsonObject[])[0]
      .message as JsonObject;
    expect(message.content).toEqual([
      {
        closed: true,
        thinking: [{ text: "Let me think", type: "text" }],
        type: "thinking",
      },
      { text: "Answer here", type: "text" },
    ]);
  });

  it("reports a length finish reason", async () => {
    const completion = await accumulateMistralCompletion(
      streamOf([
        {
          choices: [
            { delta: { content: "cut" }, finish_reason: "length", index: 0 },
          ],
        },
      ]),
    );

    expect((completion.choices as JsonObject[])[0].finishReason).toBe("length");
  });

  it("calls onActivity for every chunk", async () => {
    const onActivity = vi.fn();
    await accumulateMistralCompletion(
      streamOf([
        { choices: [{ delta: { content: "a" } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ]),
      { onActivity },
    );

    expect(onActivity).toHaveBeenCalledTimes(2);
  });

  it("throws a status-typed error for an error chunk", async () => {
    await expect(
      accumulateMistralCompletion(
        streamOf([
          {
            code: "1300",
            message: "Rate limit exceeded",
            object: "error",
            raw_status_code: 429,
            type: "rate_limited",
          },
        ]),
      ),
    ).rejects.toMatchObject({
      message: "Rate limit exceeded",
      name: "MistralHttpError",
      status: 429,
    });
  });

  it("throws when the stream ends before a finish reason", async () => {
    await expect(
      accumulateMistralCompletion(
        streamOf([{ choices: [{ delta: { content: "a" } }] }]),
      ),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      accumulateMistralCompletion(streamOf([])),
    ).rejects.toMatchObject({ status: 500 });
  });
});
