import { LlmTool } from "../types/LlmTool.interface";

const DEFAULT_TOOL_TYPE = "function";

export interface ToolkitOptions {
  explain?: boolean;
}

export class Toolkit {
  private readonly _tools: LlmTool[];
  private readonly _options: ToolkitOptions;
  private readonly explain: boolean;

  constructor(tools: LlmTool[], options?: ToolkitOptions) {
    this._tools = tools;
    this._options = options || {};
    this.explain = this._options.explain ? true : false;
  }

  get tools(): Omit<LlmTool, "call">[] {
    return this._tools.map((tool) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCopy: any = { ...tool };
      delete toolCopy.call;

      if (this.explain && toolCopy.parameters?.type === "object") {
        if (toolCopy.parameters?.properties) {
          if (!toolCopy.parameters.properties.__Explanation) {
            toolCopy.parameters.properties.__Explanation = {
              type: "string",
              description:
                "Explain the reasoning behind this function call. What is the expected result? Describe possible next steps and the conditions under which they should be taken.",
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

    const result = tool.call(parsedArgs);

    if (result instanceof Promise) {
      return await result;
    }

    return result;
  }
}
