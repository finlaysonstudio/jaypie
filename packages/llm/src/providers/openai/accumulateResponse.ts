import { errorForStatus, OpenAiApiError } from "./client.js";
import { OpenAIRawResponse } from "./types.js";

//
//
// Constants
//

const STATUS_BAD_REQUEST = 400;
const STATUS_RATE_LIMIT = 429;
const STATUS_SERVER_ERROR = 500;

// Responses API events that settle a response and carry the full object
const TERMINAL_EVENTS = new Set(["response.completed", "response.incomplete"]);

//
//
// Helpers
//

function statusForCode(code: string | undefined): number {
  if (!code) return STATUS_SERVER_ERROR;
  if (/rate_limit|insufficient_quota/.test(code)) return STATUS_RATE_LIMIT;
  if (/^invalid|unsupported|context_length|not_found/.test(code)) {
    return STATUS_BAD_REQUEST;
  }
  return STATUS_SERVER_ERROR;
}

/**
 * Build the error a streamed failure stands for (`error` event or
 * `response.failed`), typed by status so the adapter's classifier treats it
 * like the equivalent HTTP failure. Unknown codes are server errors, which
 * retry.
 */
export function streamErrorFrom(
  error: { code?: string | null; message?: string | null } | undefined,
): OpenAiApiError {
  const code = error?.code ?? undefined;
  const message =
    error?.message ?? `OpenAI stream failed${code ? ` with ${code}` : ""}`;
  return errorForStatus(statusForCode(code), message, { message });
}

//
//
// Main
//

/**
 * Accumulate a Responses API stream into the response object a non-streaming
 * request returns. The settling event (`response.completed` or
 * `response.incomplete`) carries the full response; `response.failed` and
 * `error` events throw. When a compatible server settles with an empty
 * `output`, the items finished along the way (`response.output_item.done`)
 * fill it in. `onActivity` fires on every event.
 */
export async function accumulateOpenAiResponse(
  stream: AsyncIterable<Record<string, unknown>>,
  { onActivity }: { onActivity?: () => void } = {},
): Promise<OpenAIRawResponse> {
  const items = new Map<number, unknown>();
  let settled: OpenAIRawResponse | undefined;

  for await (const event of stream) {
    onActivity?.();
    const type = event.type as string | undefined;

    if (type === "response.output_item.done") {
      const index =
        typeof event.output_index === "number"
          ? event.output_index
          : items.size;
      items.set(index, event.item);
    } else if (type && TERMINAL_EVENTS.has(type)) {
      settled = event.response as OpenAIRawResponse | undefined;
    } else if (type === "response.failed") {
      const response = event.response as
        { error?: { code?: string; message?: string } } | undefined;
      throw streamErrorFrom(response?.error);
    } else if (type === "error") {
      throw streamErrorFrom(
        event as { code?: string | null; message?: string | null },
      );
    }
  }

  // A stream that closes without settling was cut off in transit; fail the
  // attempt (retryable) rather than settle an empty response
  if (!settled) {
    throw errorForStatus(
      STATUS_SERVER_ERROR,
      "OpenAI stream ended before the response settled",
    );
  }

  if (
    (!Array.isArray(settled.output) || settled.output.length === 0) &&
    items.size > 0
  ) {
    settled.output = [...items.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, item]) => item);
  }

  return settled;
}
