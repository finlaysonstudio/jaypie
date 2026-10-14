import { describe, expect, it, vi } from "vitest";

import {
  accumulateAnthropicMessage,
  mergeDefinedFields,
} from "../accumulateMessage.js";
import { Anthropic } from "../types.js";

//
//
// Helpers
//

async function* streamOf(
  events: unknown[],
): AsyncIterable<Anthropic.MessageStreamEvent> {
  for (const event of events) {
    yield event as Anthropic.MessageStreamEvent;
  }
}

const MESSAGE_START = {
  message: {
    content: [],
    id: "msg_1",
    model: "claude-sonnet-4-6",
    role: "assistant",
    stop_reason: null,
    type: "message",
    usage: {
      cache_read_input_tokens: 5,
      input_tokens: 10,
      output_tokens: 1,
    },
  },
  type: "message_start",
};

//
//
// Run tests
//

describe("accumulateAnthropicMessage", () => {
  it("rebuilds a text message with stop reason and merged usage", async () => {
    const message = await accumulateAnthropicMessage(
      streamOf([
        MESSAGE_START,
        {
          content_block: { text: "", type: "text" },
          index: 0,
          type: "content_block_start",
        },
        { type: "ping" },
        {
          delta: { text: "Hello, ", type: "text_delta" },
          index: 0,
          type: "content_block_delta",
        },
        {
          delta: { text: "world", type: "text_delta" },
          index: 0,
          type: "content_block_delta",
        },
        { index: 0, type: "content_block_stop" },
        {
          delta: { stop_reason: "end_turn", stop_sequence: null },
          type: "message_delta",
          usage: { input_tokens: null, output_tokens: 42 },
        },
        { type: "message_stop" },
      ]),
    );

    expect(message).toEqual({
      content: [{ text: "Hello, world", type: "text" }],
      id: "msg_1",
      model: "claude-sonnet-4-6",
      role: "assistant",
      stop_reason: "end_turn",
      stop_sequence: null,
      type: "message",
      usage: {
        cache_read_input_tokens: 5,
        input_tokens: 10,
        output_tokens: 42,
      },
    });
  });

  it("rebuilds thinking, redacted thinking, and tool_use blocks in order", async () => {
    const message = await accumulateAnthropicMessage(
      streamOf([
        MESSAGE_START,
        {
          content_block: { signature: "", thinking: "", type: "thinking" },
          index: 0,
          type: "content_block_start",
        },
        {
          delta: { thinking: "Let me ", type: "thinking_delta" },
          index: 0,
          type: "content_block_delta",
        },
        {
          delta: { thinking: "think.", type: "thinking_delta" },
          index: 0,
          type: "content_block_delta",
        },
        {
          delta: { signature: "sig-abc", type: "signature_delta" },
          index: 0,
          type: "content_block_delta",
        },
        { index: 0, type: "content_block_stop" },
        {
          content_block: { data: "opaque", type: "redacted_thinking" },
          index: 1,
          type: "content_block_start",
        },
        { index: 1, type: "content_block_stop" },
        {
          content_block: {
            id: "toolu_1",
            input: {},
            name: "get_weather",
            type: "tool_use",
          },
          index: 2,
          type: "content_block_start",
        },
        {
          delta: { partial_json: '{"city":', type: "input_json_delta" },
          index: 2,
          type: "content_block_delta",
        },
        {
          delta: { partial_json: '"NYC"}', type: "input_json_delta" },
          index: 2,
          type: "content_block_delta",
        },
        { index: 2, type: "content_block_stop" },
        {
          content_block: {
            id: "toolu_2",
            input: {},
            name: "get_time",
            type: "tool_use",
          },
          index: 3,
          type: "content_block_start",
        },
        { index: 3, type: "content_block_stop" },
        {
          delta: { stop_reason: "tool_use" },
          type: "message_delta",
          usage: { output_tokens: 80 },
        },
        { type: "message_stop" },
      ]),
    );

    expect(message.stop_reason).toBe("tool_use");
    expect(message.content).toEqual([
      { signature: "sig-abc", thinking: "Let me think.", type: "thinking" },
      { data: "opaque", type: "redacted_thinking" },
      {
        id: "toolu_1",
        input: { city: "NYC" },
        name: "get_weather",
        type: "tool_use",
      },
      { id: "toolu_2", input: {}, name: "get_time", type: "tool_use" },
    ]);
  });

  it("keeps a max_tokens stop reason and unparseable partial tool input", async () => {
    const message = await accumulateAnthropicMessage(
      streamOf([
        MESSAGE_START,
        {
          content_block: { id: "t", input: {}, name: "x", type: "tool_use" },
          index: 0,
          type: "content_block_start",
        },
        {
          delta: { partial_json: '{"a": "tru', type: "input_json_delta" },
          index: 0,
          type: "content_block_delta",
        },
        {
          delta: { stop_reason: "max_tokens" },
          type: "message_delta",
          usage: { output_tokens: 16 },
        },
        { type: "message_stop" },
      ]),
    );

    expect(message.stop_reason).toBe("max_tokens");
    expect((message.content[0] as Anthropic.ToolUseBlock).input).toBe(
      '{"a": "tru',
    );
  });

  it("collects citations onto their text block", async () => {
    const citation = { cited_text: "x", type: "char_location" };
    const message = await accumulateAnthropicMessage(
      streamOf([
        MESSAGE_START,
        {
          content_block: { text: "", type: "text" },
          index: 0,
          type: "content_block_start",
        },
        {
          delta: { citation, type: "citations_delta" },
          index: 0,
          type: "content_block_delta",
        },
        {
          delta: { text: "cited", type: "text_delta" },
          index: 0,
          type: "content_block_delta",
        },
        { delta: { stop_reason: "end_turn" }, type: "message_delta" },
        { type: "message_stop" },
      ]),
    );

    expect(message.content).toEqual([
      { citations: [citation], text: "cited", type: "text" },
    ]);
  });

  it("calls onActivity for every event", async () => {
    const onActivity = vi.fn();
    await accumulateAnthropicMessage(
      streamOf([MESSAGE_START, { type: "ping" }, { type: "message_stop" }]),
      { onActivity },
    );

    expect(onActivity).toHaveBeenCalledTimes(3);
  });

  it("throws a status-typed error for a streamed error event", async () => {
    await expect(
      accumulateAnthropicMessage(
        streamOf([
          MESSAGE_START,
          {
            error: { message: "Overloaded", type: "overloaded_error" },
            type: "error",
          },
        ]),
      ),
    ).rejects.toMatchObject({
      message: "Overloaded",
      name: "InternalServerError",
      status: 529,
    });
  });

  it("throws a rate limit error for a streamed rate_limit_error", async () => {
    await expect(
      accumulateAnthropicMessage(
        streamOf([
          {
            error: { message: "Slow down", type: "rate_limit_error" },
            type: "error",
          },
        ]),
      ),
    ).rejects.toMatchObject({ name: "RateLimitError", status: 429 });
  });

  it("throws when the stream ends before message_stop", async () => {
    await expect(
      accumulateAnthropicMessage(streamOf([MESSAGE_START])),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      accumulateAnthropicMessage(streamOf([])),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe("mergeDefinedFields", () => {
  it("overlays defined values and keeps earlier ones", () => {
    expect(
      mergeDefinedFields(
        { a: 1, b: 2 as number | null },
        { a: undefined, b: null },
      ),
    ).toEqual({ a: 1, b: 2 });
    expect(mergeDefinedFields({ a: 1 }, { a: 3 })).toEqual({ a: 3 });
    expect(mergeDefinedFields({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});
