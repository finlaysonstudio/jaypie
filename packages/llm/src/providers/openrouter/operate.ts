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
import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import {
  CoreMessage,
  generateText,
  GenerateTextResult,
  jsonSchema,
  LanguageModelUsage,
  Schema,
  ToolSet,
} from "ai";

//
//
// Types
//

/**
 * OpenAI request options type that includes model and input properties
 */
export type OpenRouterRequestOptions = Omit<LlmOperateOptions, "tools"> & {
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

function updateUsage(usage: LanguageModelUsage, totalUsage: LlmUsageItem) {
  totalUsage.input += usage.promptTokens;
  totalUsage.output += usage.completionTokens;
  totalUsage.total += usage.totalTokens;
}

function handleOutputSchema(
  format: JsonObject | NaturalSchema | z.ZodType | undefined,
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
          : naturalZodSchema(format as NaturalSchema);
      schema = z.toJSONSchema(zodSchema) as JsonObject;
    }

    if (schema.$schema) {
      delete schema.$schema; // Hack to fix issue with validator
    }

    return schema;
  }
}

// Register tools and process them to work with OpenRouter
function bundleTools(
  tools: LlmTool[] | Toolkit | undefined,
  explain: boolean | undefined,
  hooks: LlmOperateOptions["hooks"],
  schema: JsonObject | undefined,
) {
  let toolkit: Toolkit | undefined;
  let processedTools: ToolSet = {};

  if (tools instanceof Toolkit) {
    toolkit = tools;
  } else if (Array.isArray(tools)) {
    toolkit = new Toolkit(tools, { explain });
  }

  if (toolkit) {
    toolkit.tools.forEach((tool) => {
      processedTools[tool.name] = {
        ...tool,
        parameters: jsonSchema(tool.parameters),
        type: "function",
        execute: async (args) => {
          let result;
          if (hooks?.beforeEachTool) {
            await hooks.beforeEachTool({
              toolName: tool.name,
              args: JSON.stringify(args),
            });
          }
          try {
            result = await toolkit.call({
              name: tool.name,
              arguments: JSON.stringify(args),
            });
          } catch (error) {
            if (hooks?.onToolError) {
              await hooks.onToolError({
                error: error as Error,
                toolName: tool.name,
                args: JSON.stringify(args),
              });
            }
            throw error;
          }
          if (hooks?.afterEachTool) {
            await hooks.afterEachTool({
              toolName: tool.name,
              args: JSON.stringify(args),
              result: JSON.stringify(result),
            });
          }
          return result;
        },
      };
    });
  }

  // There may be a fix in the future.
  // The official documentation claims that there is an experimental option for SOME models to natively support tools and structured outputs simultaneously.
  // However, it comes with a warning that the feature is experimental and may be changed in the future.
  // https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data#structured-outputs-with-generatetext-and-streamtext
  if (schema) {
    processedTools.structured_output = {
      description:
        "Output a structured JSON object. " +
        "Use this once you have finished formulating your response to give structured outputs to the user. " +
        "This tool should be used whenever you are about to give your final response to the user, in lieu of a text response.",
      parameters: jsonSchema(schema),
      type: "function",
    };
  }

  return processedTools;
}

//
//
// Main
//

export async function operate(
  input: string | LlmHistory | LlmInputMessage,
  options: LlmOperateOptions = {},
  context: { client: OpenRouterProvider; maxRetries?: number } = {
    client: createOpenRouter(),
  },
): Promise<LlmOperateResponse> {
  // Set model
  const model = options?.model || PROVIDER.OPENROUTER.MODEL.DEFAULT;

  let schema = handleOutputSchema(options.format);

  let processedTools = bundleTools(
    options.tools,
    options.explain,
    options.hooks,
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

  // Remove anything that doesn't have role and content
  const inputMessages: CoreMessage[] = structuredClone(history).filter(
    (item) => "content" in item && "role" in item,
  ) as CoreMessage[];

  inputMessages.forEach((message) => {
    delete (message as any).type;
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

  const requestOptions = {
    ...options.providerOptions,
    model: context.client(model),
    messages: inputMessages,
    system: systemPrompt,
    maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
    maxSteps: maxTurnsFromOptions(options),
    tools: processedTools,
    toolChoice: schema ? ("required" as const) : ("auto" as const),
  };

  await options.hooks?.beforeEachModelRequest?.({
    input: history,
    options,
    providerRequest: requestOptions,
  });

  let response;
  try {
    response = await generateText(requestOptions);
  } catch (error) {
    await options.hooks?.onUnrecoverableModelError?.({
      error: error as Error,
      input: history,
      options,
      providerRequest: requestOptions,
    });
    throw error;
  }

  // Update usage
  updateUsage(response.usage, totalUsage);

  await options.hooks?.afterEachModelResponse?.({
    input: history,
    options,
    providerRequest: requestOptions,
    providerResponse: response,
    content: response.text,
    usage: [totalUsage],
  });

  const structuredOutputs = response.toolCalls.filter(
    (call) => call.toolName === "structured_output",
  );

  if (response.finishReason === "tool-calls" && structuredOutputs.length == 0) {
    const returnResponse: LlmOperateResponse = {
      history: [],
      model: options?.model || PROVIDER.OPENROUTER.MODEL.DEFAULT,
      output: [],
      provider: PROVIDER.OPENROUTER.NAME,
      responses: [],
      status: LlmResponseStatus.Incomplete,
      usage: [], // Initialize as empty array, will add entry for each response
    };

    const error = new TooManyRequestsError();
    const detail = `Model requested function call but exceeded ${maxTurnsFromOptions(options)} turns`;
    log.warn(detail);
    returnResponse.error = {
      detail,
      status: error.status,
      title: error.title,
    };
    return returnResponse;
  }

  history.push({
    content:
      structuredOutputs.length > 0
        ? JSON.stringify(structuredOutputs[0].args)
        : response.text,
    role: PROVIDER.OPENROUTER.ROLE.ASSISTANT,
    type: LlmMessageType.Message,
  } as LlmOutputMessage);

  return {
    //model: model,
    //provider: PROVIDER.ANTHROPIC,
    content:
      structuredOutputs.length > 0 ? structuredOutputs[0].args : response.text,
    responses: [response as unknown as JsonObject],
    output: history.slice(-1) as LlmOutputMessage[],
    history,
    status: LlmResponseStatus.Completed,
    usage: [totalUsage],
  };
}
