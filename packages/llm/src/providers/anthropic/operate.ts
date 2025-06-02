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
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod/v4";
import ZSchema from "z-schema";

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
  // Handle structured output format
  let schema: JsonObject | undefined;
  if (options?.format) {
    // Check if format is a JsonObject with type "json_schema"
    if (
      typeof options.format === "object" &&
      options.format !== null &&
      !Array.isArray(options.format) &&
      (options.format as JsonObject).type === "json_schema"
    ) {
      // Direct pass-through for JsonObject with type "json_schema"
      schema = structuredClone(options.format) as JsonObject;
      schema.type = "object"; // Validator does not recognise "json_schema" as a type
    } else {
      // Convert NaturalSchema to JSON schema through Zod
      const zodSchema =
        options.format instanceof z.ZodType
          ? options.format
          : naturalZodSchema(options.format as NaturalSchema);
      schema = z.toJSONSchema(zodSchema) as JsonObject;
    }

    if (schema.$schema) {
      delete schema.$schema; // Hack to fix issue with validator
    }
  }

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
    system: schema
      ? "You will be responding with structured JSON data. " +
        "Format your entire response as a valid JSON object with the following structure: " +
        JSON.stringify(schema)
      : undefined,
    messages: inputMessages,
    max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
    stream: false,
  });

  let jsonResult: JsonObject | undefined;
  if (schema) {
    const validator = new ZSchema({});
    const jsonMatch =
      response.content[0].text.match(/```json\s*([\s\S]*?)\s*```/) ||
      response.content[0].text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      jsonResult = JSON.parse(jsonStr);
      if (!validator.validate(jsonResult, schema)) {
        console.log(validator.getLastError());
        throw new Error("Model returned invalid JSON");
      }
    }
  }

  history.push({
    content: response.content[0].text,
    role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
    type: LlmMessageType.Message,
  } as LlmOutputMessage);

  return {
    content: schema ? jsonResult : response.content[0].text,
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
