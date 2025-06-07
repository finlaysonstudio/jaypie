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
import { Toolkit } from "../../tools/Toolkit.class.js";

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
  // Register tools and process them to work with Anthropic
  let toolkit: Toolkit | undefined;
  let processedTools: Anthropic.Tool[] = [];
  if (options.tools?.length) {
    toolkit = new Toolkit(options.tools, { explain: options?.explain });
    toolkit.tools.forEach((tool) => {
      processedTools.push({
        ...tool,
        input_schema: {
          ...tool.parameters,
          type: "object",
        },
        type: "custom",
      });
      delete (
        processedTools[processedTools.length - 1] as unknown as {
          parameters: unknown;
        }
      ).parameters;
    });
  }

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

    processedTools.push({
      name: "structured_output",
      description:
        "Output a structured JSON object, " +
        "use this before your final response to give structured outputs to the user",
      input_schema: schema as unknown as Anthropic.Messages.Tool.InputSchema,
      type: "custom",
    });
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

  let response: Anthropic.Message;
  while (true) {
    // Loop for tool use
    response = await context.client.messages.create({
      model: options.model as Anthropic.MessageCreateParams["model"],
      system: options.system,
      messages: inputMessages,
      max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
      stream: false,
      tools: processedTools,
      tool_choice: {
        type: schema ? "any" : "auto",
      },
    });

    if (response.stop_reason !== "tool_use") {
      break;
    }

    inputMessages.push({
      role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
      content: response.content as Anthropic.TextBlockParam[],
    });

    const toolUse = response.content[
      response.content.length - 1
    ] as Anthropic.ToolUseBlock;

    if (toolUse.name === "structured_output") {
      break;
    }

    if (options.hooks?.beforeEachTool) {
      await options.hooks.beforeEachTool(
        toolUse.name,
        JSON.stringify(toolUse.input),
      );
    }

    let result: unknown;
    try {
      result = await toolkit?.call({
        name: toolUse.name,
        arguments: JSON.stringify(toolUse.input),
      });
    } catch (error) {
      if (options.hooks?.onToolError) {
        await options.hooks.onToolError(
          error as Error,
          toolUse.name,
          JSON.stringify(toolUse.input),
        );
      }
      throw error;
    }

    if (options.hooks?.afterEachTool) {
      await options.hooks.afterEachTool(
        result,
        toolUse.name,
        JSON.stringify(toolUse.input),
      );
    }

    inputMessages.push({
      role: PROVIDER.ANTHROPIC.ROLE.USER,
      content: [
        {
          type: "tool_result",
          content: JSON.stringify(result),
          tool_use_id: toolUse.id,
        },
      ],
    });

    history.push({
      call_id: toolUse.id,
      output: JSON.stringify(result),
      status: LlmResponseStatus.Completed,
      type: LlmMessageType.FunctionCallOutput,
    } as LlmToolResult);
  }

  let jsonResult: JsonObject | undefined;
  if (schema) {
    const validator = new ZSchema({});
    jsonResult = (
      response.content[response.content.length - 1] as Anthropic.ToolUseBlock
    ).input as JsonObject;

    if (!validator.validate(jsonResult, schema)) {
      throw new Error("Model returned invalid JSON");
    }
  }

  history.push({
    content: schema
      ? JSON.stringify(jsonResult)
      : (response.content[0] as Anthropic.TextBlock).text,
    role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
    type: LlmMessageType.Message,
  } as LlmOutputMessage);

  return {
    //model: options.model,
    //provider: PROVIDER.ANTHROPIC,
    content: schema
      ? jsonResult
      : (response.content[0] as Anthropic.TextBlock).text,
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
