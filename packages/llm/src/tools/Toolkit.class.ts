import { JAYPIE, log as jaypieLog } from "@jaypie/core";

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
            message = tool.message;
          } else if (typeof tool.message === "function") {
            const messageResult = tool.message(parsedArgs, { name });
            if (messageResult instanceof Promise) {
              message = await messageResult;
            } else {
              message = messageResult;
            }
          } else {
            message = String(tool.message);
          }
        } else {
          message = `${tool.name}:${JSON.stringify(parsedArgs)}`;
        }

        if (typeof this.log === "function") {
          const logResult = this.log(message, context);
          if (logResult instanceof Promise) {
            await logResult;
          }
        } else {
          logToolMessage(message, context);
        }
      } catch (error) {
        log.error("Caught error during logToolCall");
        log.var({ error });
        log.debug("Continuing...");
      }
    }

    const result = tool.call(parsedArgs);

    if (result instanceof Promise) {
      return await result;
    }

    return result;
  }
}
