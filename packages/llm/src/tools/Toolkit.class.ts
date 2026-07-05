import { JAYPIE, resolveValue } from "@jaypie/kit";
import { log as jaypieLog } from "@jaypie/logger";
import { JsonObject } from "@jaypie/types";
import { z } from "zod/v4";

import { LlmTool } from "../types/LlmTool.interface";

const DEFAULT_TOOL_TYPE = "function";

const log = jaypieLog.lib({ lib: JAYPIE.LIB.LLM });

type LogFunction = (
  message: string,
  context: { name: string; args: any },
) => void | Promise<void>;

function logToolMessage(message: string, context: { name: string; args: any }) {
  log.trace.var({ [context.name]: message });
}

export interface ToolkitOptions {
  explain?: boolean;
  log?: boolean | LogFunction;
}

export class Toolkit {
  private readonly _tools: LlmTool[];
  private readonly _options: ToolkitOptions;
  private readonly explain: boolean;
  private readonly log: boolean | LogFunction;

  constructor(tools: LlmTool[], options?: ToolkitOptions) {
    this._tools = tools;
    this._options = options || {};
    this.explain = this._options.explain ? true : false;
    this.log = this._options.log !== undefined ? this._options.log : true;
  }

  get tools(): Omit<LlmTool, "call">[] {
    return this._tools.map((tool) => {
      const toolCopy: any = { ...tool };
      delete toolCopy.call;
      delete toolCopy.message;

      // Convert Zod schema to JSON Schema if needed
      if (toolCopy.parameters instanceof z.ZodType) {
        const jsonSchema = z.toJSONSchema(toolCopy.parameters) as JsonObject;
        // Remove $schema property (causes issues with some providers)
        if (jsonSchema.$schema) {
          delete jsonSchema.$schema;
        }
        toolCopy.parameters = jsonSchema;
      }

      if (this.explain && toolCopy.parameters?.type === "object") {
        if (toolCopy.parameters?.properties) {
          if (!toolCopy.parameters.properties.__Explanation) {
            toolCopy.parameters.properties.__Explanation = {
              type: "string",
              description: `Clearly state why the tool is being called and what larger question it helps answer. For example, "I am checking the location API because the user asked for nearby pizza and I need coordinates to proceed"`,
            };
          }
        }
      }

      // Set default type if not provided
      if (!toolCopy.type) {
        toolCopy.type = DEFAULT_TOOL_TYPE;
      }

      return toolCopy;
    });
  }

  private parseArgs(args: string) {
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(args);
      if (this.explain) {
        delete parsedArgs.__Explanation;
      }
    } catch {
      parsedArgs = args;
    }
    return parsedArgs;
  }

  /**
   * Resolve a tool's `message` (static string or function of args) without
   * calling the tool. Returns undefined when the tool is missing or defines
   * no message. Never throws; resolution errors log at warn.
   */
  async resolveMessage({
    name,
    arguments: args,
  }: {
    name: string;
    arguments: string;
  }): Promise<string | undefined> {
    const tool = this._tools.find((t) => t.name === name);
    if (!tool || !tool.message) {
      return undefined;
    }

    try {
      if (typeof tool.message === "string") {
        return tool.message;
      }
      const parsedArgs = this.parseArgs(args);
      if (typeof tool.message === "function") {
        return await resolveValue(tool.message(parsedArgs, { name }));
      }
      log.warn("[Toolkit] Tool provided unknown message type");
      return String(tool.message);
    } catch (error) {
      log.warn("[Toolkit] Caught error resolving tool message");
      log.var({ error });
      return undefined;
    }
  }

  async call({
    name,
    arguments: args,
    message: resolvedMessage,
  }: {
    name: string;
    arguments: string;
    /** Pre-resolved tool message; skips re-resolving `tool.message` for logging */
    message?: string;
  }) {
    const tool = this._tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    const parsedArgs = this.parseArgs(args);

    if (this.log !== false) {
      try {
        const context: { name: string; args: any; explanation?: string } = {
          name,
          args: parsedArgs,
        };

        if (this.explain) {
          context.explanation = parsedArgs.__Explanation;
        }

        const message =
          resolvedMessage ??
          (await this.resolveMessage({ arguments: args, name })) ??
          `${tool.name}:${JSON.stringify(parsedArgs)}`;

        if (typeof this.log === "function") {
          log.trace("[Toolkit] Log tool call with custom logger");
          await resolveValue(this.log(message, context));
        } else {
          log.trace("[Toolkit] Log tool call with default logger");
          logToolMessage(message, context);
        }
      } catch (error) {
        log.error("[Toolkit] Caught error during logToolCall");
        log.var({ error });
        log.debug("[Toolkit] Continuing...");
      }
    }

    return await resolveValue(tool.call(parsedArgs));
  }

  extend(
    tools: LlmTool[],
    options: {
      warn?: boolean;
      replace?: boolean;
      log?: boolean | LogFunction;
      explain?: boolean;
    } = {},
  ): this {
    for (const tool of tools) {
      const existingIndex = this._tools.findIndex((t) => t.name === tool.name);
      if (existingIndex !== -1) {
        if (options.replace === false) {
          continue;
        }
        if (options.warn !== false) {
          if (typeof this.log === "function") {
            this.log(
              `[Toolkit] Tool '${tool.name}' already exists, replacing with new tool`,
              { name: tool.name, args: {} },
            );
          } else if (this.log) {
            log.warn(
              `[Toolkit] Tool '${tool.name}' already exists, replacing with new tool`,
            );
          }
        }
        this._tools[existingIndex] = tool;
      } else {
        this._tools.push(tool);
      }
    }
    if (Object.prototype.hasOwnProperty.call(options, "log")) {
      (this as any).log = options.log;
    }
    if (Object.prototype.hasOwnProperty.call(options, "explain")) {
      (this as any).explain = options.explain;
    }
    return this;
  }
}
