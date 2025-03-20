import { LlmTool } from "../types/LlmTool.interface";

interface ToolkitOptions {
  strict?: boolean;
}

export class Toolkit {
  private readonly _tools: LlmTool[];
  private readonly options: Required<ToolkitOptions>;

  constructor(tools: LlmTool[], options: ToolkitOptions = {}) {
    this._tools = tools;
    this.options = {
      strict: true,
      ...options,
    };
  }

  get tools(): Omit<LlmTool, "call">[] {
    return this._tools.map(({ description, name, parameters, type }) => ({
      description,
      name,
      parameters,
      type,
    }));
  }

  async call({ name, arguments: args }: { name: string; arguments: string }) {
    const tool = this._tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    let parsedArgs;
    try {
      parsedArgs = JSON.parse(args);
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
