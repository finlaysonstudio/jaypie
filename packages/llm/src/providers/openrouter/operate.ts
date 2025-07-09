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
  LanguageModelUsage,
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

// // Register tools and process them to work with Anthropic
// function bundleTools(
//   tools: LlmTool[] | Toolkit | undefined,
//   explain: boolean | undefined,
//   schema: JsonObject | undefined,
// ) {
//   let toolkit: Toolkit | undefined;
//   let processedTools: Anthropic.Tool[] = [];

//   if (tools instanceof Toolkit) {
//     toolkit = tools;
//   } else if (Array.isArray(tools)) {
//     toolkit = new Toolkit(tools, { explain });
//   }

//   if (toolkit) {
//     toolkit.tools.forEach((tool) => {
//       processedTools.push({
//         ...tool,
//         input_schema: {
//           ...tool.parameters,
//           type: "object",
//         },
//         type: "custom",
//       });
//       delete (
//         processedTools[processedTools.length - 1] as unknown as {
//           parameters: unknown;
//         }
//       ).parameters;
//     });
//   }

//   if (schema) {
//     processedTools.push({
//       name: "structured_output",
//       description:
//         "Output a structured JSON object, " +
//         "use this before your final response to give structured outputs to the user",
//       input_schema: schema as unknown as Anthropic.Messages.Tool.InputSchema,
//       type: "custom",
//     });
//   }

//   return { processedTools, toolkit };
// }

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
  if (options.format) {
    throw new Error("Structured output is not currently implemented");
  }
  if (options.tools) {
    throw new Error("Tools calling is not currently implemented");
  }

  // Set model
  const model = options?.model || PROVIDER.ANTHROPIC.MODEL.DEFAULT;

  let schema = handleOutputSchema(options.format);

  let { processedTools, toolkit } = { processedTools: [], toolkit: undefined };
  // let { processedTools, toolkit } = bundleTools(
  //   options.tools,
  //   options.explain,
  //   schema,
  // );

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

  const response = await generateText({
    model: context.client(model),
    messages: inputMessages,
    system: systemPrompt,
    maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
    tools: processedTools as unknown as ToolSet,
  });

  // Update usage
  updateUsage(response.usage, totalUsage);

  history.push({
    content: response.text,
    role: PROVIDER.OPENROUTER.ROLE.ASSISTANT,
    type: LlmMessageType.Message,
  } as LlmOutputMessage);

  return {
    //model: model,
    //provider: PROVIDER.ANTHROPIC,
    content: response.text,
    responses: [response as unknown as JsonObject],
    output: history.slice(-1) as LlmOutputMessage[],
    history,
    status: LlmResponseStatus.Completed,
    usage: [totalUsage],
  };
}
