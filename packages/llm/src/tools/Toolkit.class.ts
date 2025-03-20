import { LlmTool } from "../types/LlmTool.interface";

export class Toolkit {
  private readonly _tools: LlmTool[];

  constructor(tools: LlmTool[]) {
    this._tools = tools;
  }

  get tools(): Omit<LlmTool, "call">[] {
    return this._tools.map((tool) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCopy: any = { ...tool };
      delete toolCopy.call;
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
