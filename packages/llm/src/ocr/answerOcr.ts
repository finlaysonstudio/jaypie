import { JsonObject } from "@jaypie/types";

import { LlmUnrecoverableError } from "../errors/LlmError.js";
import { LlmOcrOptions } from "../types/LlmOcr.interface.js";
import {
  LlmOperateOptions,
  LlmOperateResponse,
} from "../types/LlmProvider.interface.js";

//
//
// Constants
//

const SYSTEM_PROMPT = [
  "The user message holds a document transcribed to Markdown by optical character recognition, enclosed in <document> tags, followed by a task.",
  "Perform the task using the document alone. Do not transcribe or repeat the document unless the task asks for it.",
  "Transcription artifacts such as [UNCLEAR: ...] or image alt text describe what the page showed.",
].join(" ");

const FORMAT_ONLY_PROMPT = "Fill the requested fields from the document.";

//
//
// Types
//

type Operate = (
  input: string,
  options: LlmOperateOptions,
) => Promise<LlmOperateResponse>;

//
//
// Main
//

/** True when the caller asked for anything beyond transcription */
export function wantsOcrAnswer({
  format,
  instructions,
}: Pick<LlmOcrOptions, "format" | "instructions"> = {}): boolean {
  return Boolean(instructions?.trim()) || Boolean(format);
}

/**
 * User message for the answer pass: the document, then the task. The task
 * comes last so a model reading a long document still acts on it rather
 * than continuing the transcription.
 */
export function buildAnswerInput({
  instructions,
  markdown,
}: {
  instructions?: string;
  markdown: string;
}): string {
  const task = instructions?.trim() || FORMAT_ONLY_PROMPT;
  return `<document>\n${markdown}\n</document>\n\n${task}`;
}

/**
 * Answer `instructions` and `format` over a finished transcription in one
 * text-only `operate()` call. Engines that see the document a page at a
 * time (emulation) or only partly (Mistral past its annotation limit) use
 * this rather than asking each page.
 */
export async function answerOcr({
  format,
  instructions,
  markdown,
  model,
  operate,
  retry,
  signal,
  user,
}: Pick<
  LlmOcrOptions,
  "format" | "instructions" | "retry" | "signal" | "user"
> & {
  markdown: string;
  model?: string;
  operate: Operate;
}): Promise<{ content: string | JsonObject; response: LlmOperateResponse }> {
  const response = await operate(buildAnswerInput({ instructions, markdown }), {
    fallback: false,
    ...(format ? { format } : {}),
    model,
    placeholders: { input: false, system: false },
    retry,
    signal,
    system: SYSTEM_PROMPT,
    temperature: 0,
    turns: 1,
    user,
  });
  if (response.error) {
    throw response.error instanceof Error
      ? response.error
      : new LlmUnrecoverableError(
          response.error.detail ?? response.error.title,
        );
  }
  const content = response.content;
  if (content === undefined || content === null) {
    throw new LlmUnrecoverableError("OCR answer pass returned no content");
  }
  return { content, response };
}
