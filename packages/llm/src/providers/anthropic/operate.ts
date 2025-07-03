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
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
import { LlmTool } from "../../types/LlmTool.interface.js";
import {
  formatOperateInput,
  log,
  maxTurnsFromOptions,
  naturalZod4Schema,
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

// Handle placeholder logic
// Convert string input to array format if needed
// Apply placeholders to fields if data is provided and placeholders.* is undefined or true
function handleInputAndPlaceholders(
  input: string | LlmHistory | LlmInputMessage,
  options: LlmOperateOptions,
) {
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

  return { history, systemPrompt, llmInstructions };
}

function updateUsage(
  usage: Anthropic.MessageCreateParamsNonStreaming.Usage,
  totalUsage: LlmUsageItem,
) {
  totalUsage.input += usage.input_tokens;
  totalUsage.output += usage.output_tokens;
  totalUsage.reasoning += usage.prompt_tokens;
  totalUsage.total += usage.input_tokens + usage.output_tokens;
}

function handleMaxTurns(
  maxTurns: number,
  history: LlmHistory,
  inputMessages: Anthropic.MessageParam[],
  response: Anthropic.Message,
  totalUsage: LlmUsageItem,
) {
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
    usage: [totalUsage],
  };
}

function handleOutputSchema(
  format:
    | JsonObject
    | NaturalSchema
    | z.ZodType<any, z.ZodTypeDef, any>
    | undefined,
) {
  let schema: JsonObject | undefined;
  if (format) {
    // Check if format is a JsonObject with type "json_schema"
    if (
      typeof format === "object" &&
      format !== null &&
      !Array.isArray(format) &&
      (format as JsonObject).type === "json_schema"
    ) {
      // Direct pass-through for JsonObject with type "json_schema"
      schema = structuredClone(format) as JsonObject;
      schema.type = "object"; // Validator does not recognise "json_schema" as a type
    } else {
      // Convert NaturalSchema to JSON schema through Zod
      const zodSchema =
        format instanceof z.ZodType
          ? format
          : naturalZod4Schema(format as NaturalSchema);
      schema = z.toJSONSchema(zodSchema) as JsonObject;
    }

    if (schema.$schema) {
      delete schema.$schema; // Hack to fix issue with validator
    }

    return schema;
  }
}

// Register tools and process them to work with Anthropic
function bundleTools(
  tools: LlmTool[] | Toolkit | undefined,
  explain: boolean | undefined,
  schema: JsonObject | undefined,
) {
  let toolkit: Toolkit | undefined;
  let processedTools: Anthropic.Tool[] = [];

  if (tools instanceof Toolkit) {
    toolkit = tools;
  } else if (Array.isArray(tools)) {
    toolkit = new Toolkit(tools, { explain });
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

  if (schema) {
    processedTools.push({
      name: "structured_output",
      description:
        "Output a structured JSON object, " +
        "use this before your final response to give structured outputs to the user",
      input_schema: schema as unknown as Anthropic.Messages.Tool.InputSchema,
      type: "custom",
    });
  }

  return { processedTools, toolkit };
}

// Handles individual tool calls. Returns true for break, false for continue.
async function callTool(
  inputMessages: Anthropic.MessageParam[],
  response: Anthropic.Message,
  hooks: LlmOperateOptions["hooks"],
  toolkit: Toolkit | undefined,
) {
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
    return true;
  }

  if (hooks?.beforeEachTool) {
    await hooks.beforeEachTool({
      toolName: toolUse.name,
      args: JSON.stringify(toolUse.input),
    });
  }

  let result: unknown;
  try {
    result = await toolkit?.call({
      name: toolUse.name,
      arguments: JSON.stringify(toolUse.input),
    });
  } catch (error) {
    if (hooks?.onToolError) {
      await hooks.onToolError({
        error: error as Error,
        toolName: toolUse.name,
        args: JSON.stringify(toolUse.input),
      });
    }
    throw error;
  }

  if (hooks?.afterEachTool) {
    await hooks.afterEachTool({
      result,
      toolName: toolUse.name,
      args: JSON.stringify(toolUse.input),
    });
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

  return false;
}

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

  let schema = handleOutputSchema(options.format);

  let { processedTools, toolkit } = bundleTools(
    options.tools,
    options.explain,
    schema,
  );

  let { history, systemPrompt, llmInstructions } = handleInputAndPlaceholders(
    input,
    options,
  );

  // If history is provided, merge it with the input
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
  let totalUsage: LlmUsageItem = {
    input: 0,
    output: 0,
    reasoning: 0,
    total: 0,
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
    updateUsage(response.usage, totalUsage);

    // If the response is not a tool use, break
    if (response.stop_reason !== "tool_use") {
      break;
    }

    const breakLoop = await callTool(
      inputMessages,
      response,
      options.hooks,
      toolkit,
    );

    if (breakLoop) {
      break;
    }

    // Handle turn limit
    if (!enableMultipleTurns || currentTurn >= maxTurns) {
      return handleMaxTurns(
        maxTurns,
        history,
        inputMessages,
        response,
        totalUsage,
      );
    }

    currentTurn++;
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
    usage: [totalUsage],
  };
}
