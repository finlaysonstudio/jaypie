# @jaypie/mcp

A Model Control Protocol (MCP) server implementation for Jaypie.

## Installation

```bash
npm install @jaypie/mcp
```

## Usage

```typescript
import { McpServer, createGreetingTool, STEAMPUNK_PIRATE_PROMPT } from "@jaypie/mcp";

// Create a new MCP server with the steampunk pirate prompt
const server = new McpServer({ 
  systemPrompt: STEAMPUNK_PIRATE_PROMPT 
});

// Register the greeting tool
server.registerTool(createGreetingTool());

// Handle a request
const response = await server.handleRequest({
  query: "Generate a greeting for Captain Brass"
});

console.log(response);
```

## Features

- Simple MCP server implementation
- Steampunk pirate-themed system prompt
- Greeting tool with customizable salutation and name

## API

### McpServer

The main server class that handles MCP requests.

```typescript
const server = new McpServer({ systemPrompt: "Your system prompt here" });
```

#### Methods

- `registerTool(tool: McpTool)` - Register a tool with the server
- `handleRequest(request: McpRequest): Promise<McpResponse>` - Handle an MCP request

### createGreetingTool

Creates a greeting tool that can be registered with the server.

```typescript
const greetingTool = createGreetingTool();
```

The greeting tool accepts the following parameters:

- `salutation` (string, optional) - The greeting to use (default: "Hello")
- `name` (string, optional) - The name to greet (default: "World")

## License

MIT