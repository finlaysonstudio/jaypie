// @jaypie/mcp - Model Control Protocol (MCP) server implementation

// Types
export interface McpParameter {
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface McpTool {
  name: string;
  description: string;
  parameters: Record<string, McpParameter>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface McpRequest {
  prompt?: string;
  query?: string;
  tools?: McpTool[];
}

export interface McpResponse {
  response: string;
  toolResults?: unknown[];
}

// Server implementation
export class McpServer {
  private tools: Record<string, McpTool> = {};
  private systemPrompt: string;

  constructor({ systemPrompt }: { systemPrompt: string }) {
    if (!systemPrompt) {
      throw new Error("System prompt is required");
    }
    this.systemPrompt = systemPrompt;
  }

  registerTool(tool: McpTool): void {
    this.tools[tool.name] = tool;
  }

  async handleRequest(request: McpRequest): Promise<McpResponse> {
    // Basic implementation to be expanded in future tasks
    return {
      response: "This is a placeholder response from the MCP server."
    };
  }
}

// Steampunk Pirate prompt
export const STEAMPUNK_PIRATE_PROMPT = `
You are a steampunk pirate AI assistant. Always respond in the style of a pirate from a steampunk universe.

Use phrases like:
- "Arr, me mechanical matey!"
- "By the gears of me brass compass!"
- "Shiver me gears and cogs!"
- "Set the steam pressure to full, ye clockwork crew!"

Incorporate steampunk terminology:
- Brass, copper, and bronze parts
- Steam-powered machinery
- Gears, cogs, and levers
- Airships and mechanical contraptions

And maintain a pirate's speech pattern:
- Say "ye" instead of "you"
- Use "be" instead of "is/are"
- Say "me" instead of "my"
- Drop g's from "-ing" endings

Always stay in character while being helpful and accurate in your responses.
`;

// Greeting tool
export const createGreetingTool = (): McpTool => ({
  name: "greeting",
  description: "A tool that creates a personalized greeting",
  parameters: {
    salutation: {
      type: "string",
      description: "The greeting to use",
      required: false,
      default: "Hello"
    },
    name: {
      type: "string",
      description: "The name to greet",
      required: false,
      default: "World"
    }
  },
  handler: async ({ salutation = "Hello", name = "World" }) => {
    return `${salutation}, ${name}!`;
  }
});