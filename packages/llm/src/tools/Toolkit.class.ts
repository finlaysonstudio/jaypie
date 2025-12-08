import { JAYPIE, resolveValue } from "@jaypie/kit";
import { log as jaypieLog } from "@jaypie/logger";

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

  async call({ name, arguments: args }: { name: string; arguments: string }) {
    const tool = this._tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    let parsedArgs;
    try {
      parsedArgs = JSON.parse(args);
      if (this.explain) {
        delete parsedArgs.__Explanation;
      }
    } catch {
      parsedArgs = args;
    }

    if (this.log !== false) {
      try {
        const context: { name: string; args: any; explanation?: string } = {
          name,
          args: parsedArgs,
        };
        let message: string;

        if (this.explain) {
          context.explanation = parsedArgs.__Explanation;
        }

        if (tool.message) {
          if (typeof tool.message === "string") {
            log.trace("[Toolkit] Tool provided string message");
            message = tool.message;
          } else if (typeof tool.message === "function") {
            log.trace("[Toolkit] Tool provided function message");
            log.trace("[Toolkit] Resolving message result");
            message = await resolveValue(tool.message(parsedArgs, { name }));
          } else {
            log.warn("[Toolkit] Tool provided unknown message type");
            message = String(tool.message);
          }
        } else {
          log.trace("[Toolkit] Log tool call with default message");
          message = `${tool.name}:${JSON.stringify(parsedArgs)}`;
        }

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
