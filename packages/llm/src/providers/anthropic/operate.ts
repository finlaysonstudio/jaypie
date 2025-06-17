import { Anthropic } from "@anthropic-ai/sdk";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageType,
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
} from "../../util";
import { PROVIDER } from "../../constants.js";
import {
  JsonArray,
  JsonObject,
  JsonReturn,
  NaturalSchema,
} from "@jaypie/types";
import { z } from "zod/v4";
import ZSchema from "z-schema";
import { Toolkit } from "../../tools/Toolkit.class.js";
import { placeholders } from "@jaypie/core";
import { TooManyRequestsError } from "@jaypie/errors";

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
  // Set model
  const model = options?.model || PROVIDER.ANTHROPIC.MODEL.DEFAULT;

  // Register tools and process them to work with Anthropic
  let toolkit: Toolkit | undefined;
  let processedTools: Anthropic.Tool[] = [];

  if (options.tools instanceof Toolkit) {
    toolkit = options.tools;
  } else if (Array.isArray(options.tools)) {
    toolkit = new Toolkit(options.tools, { explain: options?.explain });
  }

  if (toolkit) {
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

  // Handle placeholder logic
  // Convert string input to array format if needed
  // Apply placeholders to fields if data is provided and placeholders.instructions is undefined or true
  let history: LlmHistory = formatOperateInput(input);
  let llmInstructions: string | undefined;
  let systemPrompt: string | undefined;
  if (
    options?.data &&
    (options.placeholders?.input === undefined || options.placeholders?.input)
  ) {
    history = formatOperateInput(input, {
      data: options?.data,
    });
  }
  if (options?.instructions) {
    llmInstructions =
      options.data && options.placeholders?.instructions !== false
        ? placeholders(options.instructions, options.data)
        : options.instructions;
  }
  if (options?.system) {
    systemPrompt =
      options.data && options.placeholders?.system !== false
        ? placeholders(options.system, options.data)
        : options.system;
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

  // Add instruction to the input message
  if (llmInstructions) {
    inputMessages[inputMessages.length - 1].content += "\n\n" + llmInstructions;
  }

  // Setup usage tracking
  let totalUsage = {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  };

  // Determine max turns from options
  const maxTurns = maxTurnsFromOptions(options);
  const enableMultipleTurns = maxTurns > 1;
  let currentTurn = 0;

  let response: Anthropic.Message;
  while (true) {
    // Loop for tool use
    response = await context.client.messages.create({
      model: model as Anthropic.MessageCreateParams["model"],
      system: systemPrompt,
      messages: inputMessages,
      max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
      stream: false,
      tools: processedTools,
      tool_choice:
        processedTools.length > 0
          ? { type: schema ? "any" : "auto" }
          : undefined,
      ...options?.providerOptions,
    });

    // Update usage
    totalUsage.input_tokens += response.usage.input_tokens;
    totalUsage.output_tokens += response.usage.output_tokens;
    totalUsage.total_tokens +=
      response.usage.input_tokens + response.usage.output_tokens;

    // If the response is not a tool use, break
    if (response.stop_reason !== "tool_use") {
      break;
    }

    inputMessages.push({
      role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
      content: response.content as Anthropic.TextBlockParam[],
    });

    // Get the tool use
    const toolUse = response.content[
      response.content.length - 1
    ] as Anthropic.ToolUseBlock;

    // If the tool use is structured output (magic tool), break
    if (toolUse.name === "structured_output") {
      break;
    }

    // Handle turn limit
    if (!enableMultipleTurns || currentTurn >= maxTurns) {
      const error = new TooManyRequestsError();
      const detail = `Model requested function call but exceeded ${maxTurns} turns`;
      log.warn(detail);
      return {
        //model: model,
        //provider: PROVIDER.ANTHROPIC,
        error: {
          detail,
          status: error.status,
          title: error.title,
        },
        history,
        output: inputMessages.slice(-1) as LlmOutputMessage[],
        responses: response.content as unknown as JsonReturn[],
        status: LlmResponseStatus.Incomplete,
        usage: {
          input: totalUsage.input_tokens,
          output: totalUsage.output_tokens,
          reasoning: 0,
          total: totalUsage.total_tokens,
        },
      };
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
    //model: model,
    //provider: PROVIDER.ANTHROPIC,
    content: schema
      ? jsonResult
      : (response.content[0] as Anthropic.TextBlock).text,
    responses: [response as unknown as JsonObject],
    output: history.slice(-1) as LlmOutputMessage[],
    history,
    status: LlmResponseStatus.Completed,
    usage: {
      input: totalUsage.input_tokens,
      output: totalUsage.output_tokens,
      reasoning: 0,
      total: totalUsage.total_tokens,
    },
  };
}
