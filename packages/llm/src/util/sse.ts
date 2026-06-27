import { JsonObject } from "@jaypie/types";

const DEFAULT_DONE_SENTINEL = "[DONE]";

/**
 * Parse a Server-Sent Events stream into decoded JSON chunks. Buffers across
 * network reads, dispatches on newline-delimited `data:` lines, and stops at
 * the done sentinel (OpenAI-style `[DONE]`; Gemini omits it and simply ends
 * the stream). Comment lines (`: ...`, used for keep-alive) are ignored.
 *
 * Shared by the provider HTTP clients that replaced their vendor SDKs.
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  { doneSentinel = DEFAULT_DONE_SENTINEL }: { doneSentinel?: string } = {},
): AsyncIterable<JsonObject> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);

        if (line === "" || line.startsWith(":")) continue;
        if (!line.startsWith("data:")) continue;

        const data = line.slice("data:".length).trim();
        if (data === doneSentinel) return;

        yield JSON.parse(data) as JsonObject;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
