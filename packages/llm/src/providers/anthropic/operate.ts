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
  LlmHistoryItem,
} from "../../types/LlmProvider.interface.js";
import { LlmTool } from "../../types/LlmTool.interface.js";
import {
  formatOperateInput,
  log,
  maxTurnsFromOptions,
  naturalZodSchema,
  resolvePromise,
} from "../../util";
import {
  createTextCompletion,
  formatUserMessage,
  prepareMessages,
} from "./index.js";
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
  // Convert string input to array format with placeholders if needed
  let history: LlmHistory = formatOperateInput(input);
  if (
    options?.data &&
    (options.placeholders?.input === undefined || options.placeholders?.input)
  ) {
    history = formatOperateInput(input, {
      data: options?.data,
    });
  }

  // If history is provided, merge it with currentInput
  if (options.history) {
    history = [...options.history, ...history];
  }

  // Avoid Anthropic error by removing type property
  const inputMessages: Anthropic.MessageParam[] = structuredClone(history);
  inputMessages.forEach((message) => {
    delete message.type;
  });

  const response = await context.client.messages.create({
    model: options.model as Anthropic.MessageCreateParams["model"],
    messages: inputMessages,
    max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
    stream: false,
  });

  history.push({
    content: response.content[0].text,
    role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
    type: LlmMessageType.Message,
  } as LlmOutputMessage);

  return {
    content: response.content[0].text,
    responses: [response as unknown as JsonObject],
    output: history.slice(-1) as LlmOutputMessage[],
    history,
    status: LlmResponseStatus.Completed,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      reasoning: 0,
      total: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}
