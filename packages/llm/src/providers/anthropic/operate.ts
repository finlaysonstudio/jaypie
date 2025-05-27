import { Anthropic } from "@anthropic-ai/sdk";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageType,
  LlmMessageRole,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmResponseStatus,
  LlmToolResult,
  LlmOutputMessage,
} from "../../types/LlmProvider.interface.js";
import { LlmTool } from "../../types/LlmTool.interface.js";
import {
  formatOperateInput,
  log,
  maxTurnsFromOptions,
  naturalZodSchema,
  resolvePromise,
} from "../../util";
import { createTextCompletion, prepareMessages } from "./index.js";
import { PROVIDER } from "../../constants.js";
import { JsonObject } from "@jaypie/types";

//
//
// Types
//

/**
 * OpenAI request options type that includes model and input properties
 */
export type AnthropicRequestOptions = Omit<LlmOperateOptions, "tools"> & {
  model: string;
  input: LlmInputMessage | LlmHistory;
  text?: unknown;
  tools?: Omit<LlmTool, "call">[];
};

//
//
// Main
//

export async function operate(
  input: string | LlmHistory | LlmInputMessage,
  options: LlmOperateOptions = {},
  context: { client: Anthropic; maxRetries?: number } = {
    client: new Anthropic(),
  },
): Promise<LlmOperateResponse> {
  const response = await context.client.messages.create({
    model: options.model as Anthropic.MessageCreateParams["model"],
    messages: prepareMessages(input as string, options),
    max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
    stream: false,
  });

  return {
    content: response.content[0].text,
    responses: [response as unknown as JsonObject],
    output: [
      {
        content: response.content[0].text,
        role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
      } as LlmOutputMessage,
    ],
    history: [],
    status: LlmResponseStatus.Completed,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      reasoning: 0,
      total: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}
