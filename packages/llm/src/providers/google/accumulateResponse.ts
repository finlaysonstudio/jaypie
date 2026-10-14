import { GoogleHttpError, responseText } from "./client.js";
import { GeminiCandidate, GeminiPart, GeminiRawResponse } from "./types.js";

//
//
// Constants
//

const STATUS_SERVER_ERROR = 500;

//
//
// Helpers
//

/** A part that holds only text (and possibly a thought flag or signature) */
function isTextPart(part: GeminiPart): boolean {
  return (
    typeof part.text === "string" &&
    !part.functionCall &&
    !part.functionResponse &&
    !part.inlineData &&
    !part.fileData
  );
}

/**
 * Append a streamed part, concatenating it onto the previous part when both
 * are text of the same kind (thought or answer). A part whose predecessor
 * already carries a thought signature starts a new part, so each signature
 * stays on the part it was issued for. A trailing signature (often sent on an
 * empty text part) attaches to the text it closes.
 */
function appendPart(parts: GeminiPart[], part: GeminiPart): void {
  const previous = parts[parts.length - 1];
  if (
    previous &&
    isTextPart(previous) &&
    isTextPart(part) &&
    Boolean(previous.thought) === Boolean(part.thought) &&
    !previous.thoughtSignature
  ) {
    previous.text = `${previous.text ?? ""}${part.text ?? ""}`;
    if (part.thoughtSignature) {
      previous.thoughtSignature = part.thoughtSignature;
    }
    return;
  }
  parts.push({ ...part });
}

function mergeCandidate(target: GeminiCandidate, chunk: GeminiCandidate): void {
  for (const part of chunk.content?.parts ?? []) {
    if (!target.content) {
      target.content = { parts: [], role: chunk.content?.role ?? "model" };
    }
    if (!target.content.parts) target.content.parts = [];
    appendPart(target.content.parts, part);
  }
  if (chunk.content?.role && target.content) {
    target.content.role = chunk.content.role;
  }
  if (chunk.finishReason) target.finishReason = chunk.finishReason;
  if (chunk.finishMessage) target.finishMessage = chunk.finishMessage;
  if (chunk.safetyRatings) target.safetyRatings = chunk.safetyRatings;
  if (chunk.citationMetadata?.citations) {
    target.citationMetadata = {
      citations: [
        ...(target.citationMetadata?.citations ?? []),
        ...chunk.citationMetadata.citations,
      ],
    };
  }
  if (chunk.tokenCount !== undefined) target.tokenCount = chunk.tokenCount;
  if (chunk.avgLogprobs !== undefined) target.avgLogprobs = chunk.avgLogprobs;
}

//
//
// Main
//

/**
 * Accumulate a `streamGenerateContent` (SSE) stream into the response a
 * non-streaming `generateContent` returns: candidates merged by index (text
 * parts concatenated, function calls and thought signatures kept), the last
 * finish reason, usage metadata, and prompt feedback, plus the response id
 * and model version. A chunk carrying an `error` throws. `onActivity` fires
 * on every chunk.
 */
export async function accumulateGoogleResponse(
  stream: AsyncIterable<GeminiRawResponse>,
  { onActivity }: { onActivity?: () => void } = {},
): Promise<GeminiRawResponse> {
  const candidates = new Map<number, GeminiCandidate>();
  const response: GeminiRawResponse = {};
  let received = false;

  for await (const chunk of stream) {
    onActivity?.();
    received = true;

    const error = (
      chunk as { error?: { code?: number; message?: string; status?: string } }
    ).error;
    if (error) {
      throw new GoogleHttpError(
        error.code ?? STATUS_SERVER_ERROR,
        error.message ??
          `Google stream failed${error.status ? ` with ${error.status}` : ""}`,
      );
    }

    for (const [position, candidate] of (chunk.candidates ?? []).entries()) {
      const index = candidate.index ?? position;
      const target = candidates.get(index) ?? { index };
      if (!candidates.has(index)) candidates.set(index, target);
      mergeCandidate(target, candidate);
    }

    if (chunk.usageMetadata) response.usageMetadata = chunk.usageMetadata;
    if (chunk.promptFeedback) response.promptFeedback = chunk.promptFeedback;
    if (chunk.modelVersion) response.modelVersion = chunk.modelVersion;
    if (chunk.responseId) response.responseId = chunk.responseId;
    if (chunk.createTime) response.createTime = chunk.createTime;
  }

  if (!received) {
    throw new GoogleHttpError(
      STATUS_SERVER_ERROR,
      "Google stream ended without a response",
    );
  }

  if (candidates.size > 0) {
    response.candidates = [...candidates.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, candidate]) => candidate);
  }
  response.text = responseText(response);
  return response;
}
