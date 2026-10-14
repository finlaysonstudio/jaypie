import { describe, expect, it, vi } from "vitest";

import { accumulateOpenAiResponse } from "../accumulateResponse.js";

//
//
// Helpers
//

async function* streamOf(
  events: Record<string, unknown>[],
): AsyncIterable<Record<string, unknown>> {
  for (const event of events) {
    yield event;
  }
}

const REASONING_ITEM = {
  encrypted_content: "enc",
  id: "rs_1",
  summary: [],
  type: "reasoning",
};
const FUNCTION_CALL_ITEM = {
  arguments: '{"city":"NYC"}',
  call_id: "call_1",
  id: "fc_1",
  name: "get_weather",
  type: "function_call",
};

//
//
// Run tests
//

describe("accumulateOpenAiResponse", () => {
  it("returns the full response carried by response.completed", async () => {
    const completed = {
      id: "resp_1",
      output: [REASONING_ITEM, FUNCTION_CALL_ITEM],
      status: "completed",
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        output_tokens_details: { reasoning_tokens: 8 },
        total_tokens: 30,
      },
    };
    const response = await accumulateOpenAiResponse(
      streamOf([
        {
          response: { id: "resp_1", status: "in_progress" },
          type: "response.created",
        },
        { delta: '{"city":', type: "response.function_call_arguments.delta" },
        {
          item: FUNCTION_CALL_ITEM,
          output_index: 1,
          type: "response.output_item.done",
        },
        { response: completed, type: "response.completed" },
      ]),
    );

    expect(response).toEqual(completed);
  });

  it("returns an incomplete response with its reason", async () => {
    const incomplete = {
      incomplete_details: { reason: "max_output_tokens" },
      output: [
        {
          content: [{ text: "partial", type: "output_text" }],
          type: "message",
        },
      ],
      status: "incomplete",
    };
    const response = await accumulateOpenAiResponse(
      streamOf([{ response: incomplete, type: "response.incomplete" }]),
    );

    expect(response.status).toBe("incomplete");
    expect(response.incomplete_details).toEqual({
      reason: "max_output_tokens",
    });
  });

  it("fills an empty settled output from finished items", async () => {
    const response = await accumulateOpenAiResponse(
      streamOf([
        {
          item: FUNCTION_CALL_ITEM,
          output_index: 1,
          type: "response.output_item.done",
        },
        {
          item: REASONING_ITEM,
          output_index: 0,
          type: "response.output_item.done",
        },
        {
          response: { output: [], status: "completed" },
          type: "response.completed",
        },
      ]),
    );

    expect(response.output).toEqual([REASONING_ITEM, FUNCTION_CALL_ITEM]);
  });

  it("calls onActivity for every event", async () => {
    const onActivity = vi.fn();
    await accumulateOpenAiResponse(
      streamOf([
        { delta: "a", type: "response.output_text.delta" },
        { delta: "b", type: "response.output_text.delta" },
        { response: { output: [] }, type: "response.completed" },
      ]),
      { onActivity },
    );

    expect(onActivity).toHaveBeenCalledTimes(3);
  });

  it("throws a server error for response.failed", async () => {
    await expect(
      accumulateOpenAiResponse(
        streamOf([
          {
            response: {
              error: { code: "server_error", message: "Boom" },
              status: "failed",
            },
            type: "response.failed",
          },
        ]),
      ),
    ).rejects.toMatchObject({
      message: "Boom",
      name: "InternalServerError",
      status: 500,
    });
  });

  it("throws a rate limit error for a rate-limited error event", async () => {
    await expect(
      accumulateOpenAiResponse(
        streamOf([
          {
            code: "rate_limit_exceeded",
            message: "Slow down",
            type: "error",
          },
        ]),
      ),
    ).rejects.toMatchObject({ name: "RateLimitError", status: 429 });
  });

  it("throws a bad request error for an invalid request error event", async () => {
    await expect(
      accumulateOpenAiResponse(
        streamOf([{ code: "invalid_prompt", message: "Nope", type: "error" }]),
      ),
    ).rejects.toMatchObject({ name: "BadRequestError", status: 400 });
  });

  it("throws when the stream ends before the response settles", async () => {
    await expect(
      accumulateOpenAiResponse(
        streamOf([{ delta: "a", type: "response.output_text.delta" }]),
      ),
    ).rejects.toMatchObject({ status: 500 });
  });
});
