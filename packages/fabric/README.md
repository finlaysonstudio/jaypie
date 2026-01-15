# @jaypie/fabric

Jaypie modeling framework with type conversion, service handlers, and adapters for CLI, Lambda, LLM, and MCP.

## Install

```bash
npm install @jaypie/fabric
```

## Usage

### fabricService

Create validated service endpoints with automatic type conversion:

```typescript
import { fabricService } from "@jaypie/fabric";

const divisionHandler = fabricService({
  alias: "division",
  description: "Divides two numbers",
  input: {
    numerator: {
      default: 12,
      description: "Number 'on top', which is to be divided",
      type: Number,
    },
    denominator: {
      default: 3,
      description: "Number 'on bottom', how many ways to split the value",
      type: Number,
      validate: (value) => value !== 0,
    }
  },
  service: ({ numerator, denominator }) => (numerator / denominator),
});

await divisionHandler(); // =4
await divisionHandler({ numerator: 24 }); // =8
await divisionHandler({ numerator: 24, denominator: 2 }); // =12
await divisionHandler({ numerator: "14", denominator: "7" }); // =2
await divisionHandler({ numerator: 1, denominator: 0 }); // throws BadRequestError(); does not validate
await divisionHandler('{ "numerator": "18" }'); // =3; String parses as JSON
```

### Type Conversion (Fabric Functions)

```typescript
import { fabric, fabricNumber, fabricBoolean, fabricString } from "@jaypie/fabric";

fabricBoolean("true");     // true
fabricBoolean(1);          // true
fabricNumber("42");        // 42
fabricNumber(true);        // 1
fabricString(true);        // "true"
fabricString(42);          // "42"
```

### Commander Adapter

```typescript
import { Command } from "commander";
import { fabricService } from "@jaypie/fabric";
import { fabricCommand } from "@jaypie/fabric/commander";

const handler = fabricService({
  alias: "greet",
  description: "Greet a user",
  input: {
    userName: { type: String, flag: "user", letter: "u" },
    loud: { type: Boolean, letter: "l", default: false },
  },
  service: ({ loud, userName }) => {
    const greeting = `Hello, ${userName}!`;
    return loud ? greeting.toUpperCase() : greeting;
  },
});

const program = new Command();
fabricCommand({ service: handler, program });
program.parse();
// Usage: greet --user Alice -l
```

### Lambda Adapter

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricLambda } from "@jaypie/fabric/lambda";

const evaluationsHandler = fabricService({
  alias: "evaluationsHandler",
  input: {
    count: { type: Number, default: 1 },
    models: { type: [String], default: [] },
    plan: { type: String },
  },
  service: ({ count, models, plan }) => ({
    jobId: `job-${Date.now()}`,
    plan,
  }),
});

export const handler = fabricLambda(evaluationsHandler, {
  secrets: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
});
```

### LLM Adapter

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricTool } from "@jaypie/fabric/llm";
import { Toolkit } from "@jaypie/llm";

const handler = fabricService({
  alias: "greet",
  description: "Greet a user by name",
  input: {
    userName: { type: String, description: "The user's name" },
    loud: { type: Boolean, default: false, description: "Shout the greeting" },
  },
  service: ({ userName, loud }) => {
    const greeting = `Hello, ${userName}!`;
    return loud ? greeting.toUpperCase() : greeting;
  },
});

const { tool } = fabricTool({ service: handler });
const toolkit = new Toolkit([tool]);
```

### MCP Adapter

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fabricService } from "@jaypie/fabric";
import { fabricMcp } from "@jaypie/fabric/mcp";

const handler = fabricService({
  alias: "greet",
  description: "Greet a user by name",
  input: {
    userName: { type: String, description: "The user's name" },
    loud: { type: Boolean, default: false, description: "Shout the greeting" },
  },
  service: ({ userName, loud }) => {
    const greeting = `Hello, ${userName}!`;
    return loud ? greeting.toUpperCase() : greeting;
  },
});

const server = new McpServer({ name: "my-server", version: "1.0.0" });
fabricMcp({ service: handler, server });
```

## API

### Main Export (`@jaypie/fabric`)

| Export | Description |
|--------|-------------|
| `fabricService` | Factory function for validated service endpoints |
| `fabric` | Master conversion dispatcher |
| `fabricBoolean` | Convert to boolean |
| `fabricNumber` | Convert to number |
| `fabricString` | Convert to string |
| `fabricArray` | Wrap in array |
| `convertFromArray` | Extract from single-element array |
| `fabricObject` | Wrap in `{ value: ... }` |
| `convertFromObject` | Extract `.value` from object |
| `fabricDate` | Convert to Date |
| `convertFromDate` | Convert from Date to string |
| `FabricModel` | Base type for models |
| `FabricMessage` | Message model type |
| `FabricJob` | Job model type |
| `FabricProgress` | Progress tracking type |
| `registerModel` | Register custom indexes for a model |
| `getModelIndexes` | Get indexes for a model |
| `populateIndexKeys` | Populate GSI keys on an entity |
| `buildCompositeKey` | Build composite key from fields |
| `calculateOu` | Calculate organizational unit |
| `DEFAULT_INDEXES` | Default GSI indexes |
| `APEX` | Root-level marker (`"@"`) |
| `SEPARATOR` | Composite key separator (`"#"`) |
| `ARCHIVED_SUFFIX` | Suffix for archived entities |
| `DELETED_SUFFIX` | Suffix for deleted entities |

### Sub-Exports

| Path | Description |
|------|-------------|
| `@jaypie/fabric/commander` | Commander.js CLI adapter |
| `@jaypie/fabric/lambda` | AWS Lambda adapter |
| `@jaypie/fabric/llm` | LLM tool adapter |
| `@jaypie/fabric/mcp` | MCP server adapter |

## Philosophy

The "Fabric" philosophy:
- **Smooth, pliable** - Things that feel right should work
- **Catch bad passes** - Invalid inputs throw clear errors

This means:
- `"true"` works where `true` is expected
- `"42"` works where `42` is expected
- JSON strings automatically parse
- Invalid conversions fail fast with `BadRequestError`

## License

MIT
