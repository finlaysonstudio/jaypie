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

### Express Adapter

```typescript
import { Router } from "express";
import { fabricHttp } from "@jaypie/fabric/http";
import { fabricExpress, FabricRouter } from "@jaypie/fabric/express";

// Create a fabricHttp service
const userService = fabricHttp({
  alias: "users",
  input: {
    id: { type: String, required: false },
  },
  service: ({ id }) => id ? getUser(id) : listUsers(),
});

// Option 1: Single service as middleware
const middleware = fabricExpress({ service: userService });
router.use("/api", middleware);
// Routes: GET/POST/DELETE /api/users

// Option 2: Multiple services with FabricRouter
const productService = fabricHttp({
  alias: "products",
  service: () => listProducts(),
});

const router = FabricRouter({
  services: [
    userService,
    productService,
    {
      service: userService,
      path: "/users/:id",
      methods: ["GET", "PUT", "DELETE"],
    },
  ],
});

app.use("/v1", router);
// Routes: /v1/users, /v1/products, /v1/users/:id
```

### HTTP Adapter

Create HTTP-aware services with built-in authorization and CORS support:

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricHttp } from "@jaypie/fabric/http";

// Inline service definition
const userService = fabricHttp({
  alias: "users",
  description: "User management API",
  input: {
    id: { type: String },
    name: { type: String, required: false },
  },
  // Authorization: function receives token from Authorization header
  // (Bearer prefix removed, whitespace stripped)
  authorization: async (token) => {
    const user = await validateJwt(token);
    if (!user) throw new UnauthorizedError();
    return user; // Available in context.auth
  },
  // CORS enabled by default, customize as needed
  cors: {
    origin: ["https://app.example.com"],
    credentials: true,
  },
  service: ({ id, name }, context) => {
    console.log("Authenticated user:", context.auth);
    return { id, name };
  },
});

// Or wrap an existing fabricService
const coreService = fabricService({
  alias: "division",
  input: {
    numerator: { type: Number },
    denominator: { type: Number },
  },
  service: ({ numerator, denominator }) => numerator / denominator,
});

const divisionApi = fabricHttp({
  service: coreService,
  authorization: false, // Public endpoint
});
```

#### HTTP Transformation

Customize how HTTP context maps to service input:

```typescript
const customService = fabricHttp({
  alias: "custom",
  input: {
    userId: { type: String },
    action: { type: String },
  },
  // Transform HTTP context to service input
  http: ({ headers, params, body }) => ({
    userId: headers.get("x-user-id") ?? params.userId,
    action: body.action,
  }),
  service: ({ userId, action }) => performAction(userId, action),
});
```

#### HTTP Streaming

Enable NDJSON streaming for long-running tasks or LLM responses:

```typescript
import { fabricHttp, pipeLlmStream } from "@jaypie/fabric/http";
import Llm from "@jaypie/llm";

const streamingService = fabricHttp({
  alias: "chat",
  input: { message: { type: String } },
  stream: true, // Enable NDJSON streaming
  service: async function* ({ message }, context) {
    // Send progress messages (streamed as message events)
    context.sendMessage({ content: "Processing...", level: "info" });

    // Stream LLM response
    const llmStream = Llm.stream(message);
    yield* pipeLlmStream(llmStream);
  },
});
```

Stream events use NDJSON format with `stream` as the discriminator field:

```json
{"stream":"message","content":"Processing...","level":"info"}
{"stream":"text","content":"Hello"}
{"stream":"tool_call","toolCall":{"id":"...","name":"...","arguments":"..."}}
{"stream":"tool_result","toolResult":{"id":"...","name":"...","result":"..."}}
{"stream":"data","data":{"result":42}}
{"stream":"error","error":{"status":500,"title":"Error"}}
{"stream":"noop"}
{"stream":"complete"}
```

Streaming utilities:
- `pipeLlmStream(llmStream)` - Convert @jaypie/llm stream to HTTP events
- `createStreamContext(writer)` - Create context with `streamText()` and `streamEvent()` methods
- `createCompleteEvent()` - Create stream completion event
- `createNoopEvent()` - Create keep-alive signal (empty event)
- `formatNdjsonEvent(event)` / `formatSseEvent(event)` - Format events for output

#### FabricHttpServer (Standalone Lambda)

Route multiple services in a single Lambda function without Express:

```typescript
import { fabricHttp, FabricHttpServer } from "@jaypie/fabric/http";
import { lambdaHandler } from "@jaypie/lambda";

// Create HTTP services
const userService = fabricHttp({
  alias: "users",
  input: { id: { type: String, required: false } },
  service: ({ id }) => id ? getUser(id) : listUsers(),
});

const productService = fabricHttp({
  alias: "products",
  service: () => listProducts(),
});

// Create standalone server
const server = FabricHttpServer({
  services: [
    userService,
    productService,
    { service: userService, path: "/users/:id", methods: ["GET", "PUT"] },
  ],
  prefix: "/api",  // Optional path prefix
  cors: true,      // Server-level CORS (default: true)
});

// Export as Lambda handler
export const handler = lambdaHandler(server);
// Routes: /api/users, /api/products, /api/users/:id
```

FabricHttpServer handles:
- API Gateway v1 (REST API) and v2 (HTTP API) event formats
- Route matching by path pattern and HTTP method
- CORS preflight requests and response headers
- JSON:API formatted responses (`{ data }` / `{ errors }`)
- 404 Not Found and 405 Method Not Allowed responses

### Data Adapter (FabricData)

Generate CRUD HTTP services for Jaypie models backed by DynamoDB:

```typescript
import { FabricData } from "@jaypie/fabric/data";
import { FabricHttpServer } from "@jaypie/fabric/http";

// Basic usage - creates all CRUD services
const recordServices = FabricData({ model: "record" });

// Use with FabricHttpServer
const server = FabricHttpServer({
  services: recordServices.services,
  prefix: "/api",
});

export const handler = server.handler;
// Routes: POST /api/records, GET /api/records, GET /api/records/:id,
//         POST /api/records/:id, DELETE /api/records/:id, POST /api/records/:id/archive
```

#### Route Mapping

| Operation | HTTP Method | Route | DynamoDB Function |
|-----------|-------------|-------|-------------------|
| create | POST | `/{model}` | `putEntity` |
| list | GET | `/{model}` | `queryByScope` |
| read | GET | `/{model}/:id` | `getEntity` |
| update | POST | `/{model}/:id` | `updateEntity` |
| delete | DELETE | `/{model}/:id` | `deleteEntity` |
| archive | POST | `/{model}/:id/archive` | `archiveEntity` |
| *custom* | POST | `/{model}/:id/{action}` | custom service |

Custom operations are defined in the `execute` array and create routes like `/records/:id/publish`.

#### Configuration

```typescript
const services = FabricData({
  // Model: string or config object
  model: "record",  // Or: { alias: "record", name: "Record", description: "..." }

  // Authorization for all operations
  authorization: async (token) => {
    const user = await validateJwt(token);
    if (!user) throw new UnauthorizedError();
    return user;
  },

  // CORS configuration
  cors: { origin: "*" },

  // Scope calculator (default: APEX "@")
  // Determines how entities are grouped for queries
  scope: ({ params }) => `chat#${params.chatId}`,

  // Pagination limits
  defaultLimit: 20,  // Default items per page
  maxLimit: 100,     // Maximum items per page

  // Per-operation configuration
  operations: {
    read: { authorization: false },         // Public read
    list: { authorization: false },         // Public list
    delete: { authorization: requireAdmin }, // Admin-only delete
    archive: false,                          // Disable archive
    create: {
      // Transform input before saving
      transform: (input, existing) => ({
        ...input,
        createdBy: input.userId,
      }),
    },
  },
});
```

#### Custom Execute Actions

Add custom actions that operate on entities:

```typescript
const services = FabricData({
  model: "record",
  execute: [
    {
      alias: "publish",
      description: "Publish a record",
      authorization: requireEditor,
      input: {
        publishDate: { type: Date, required: false },
        notify: { type: Boolean, default: false },
      },
      service: async (entity, { publishDate, notify }) => {
        // entity is the fetched record
        const { updateEntity } = await import("@jaypie/dynamodb");
        await updateEntity({
          entity: {
            ...entity,
            metadata: { ...entity.metadata, publishedAt: publishDate ?? new Date() },
          },
        });
        if (notify) await sendNotification(entity);
        return { published: true };
      },
    },
    {
      alias: "duplicate",
      description: "Create a copy of a record",
      service: async (entity) => {
        const { putEntity } = await import("@jaypie/dynamodb");
        const duplicate = {
          ...entity,
          id: crypto.randomUUID(),
          name: `${entity.name} (Copy)`,
        };
        delete duplicate.alias;
        return putEntity({ entity: duplicate });
      },
    },
  ],
});
// Routes: POST /records/:id/publish, POST /records/:id/duplicate
```

#### List Pagination

The list operation supports pagination via cursor:

```typescript
// First request
GET /api/records?limit=10

// Response
{
  "data": {
    "items": [...],
    "nextKey": "eyJpZCI6Ii4uLiJ9"  // Base64 encoded cursor
  }
}

// Next page
GET /api/records?limit=10&cursor=eyJpZCI6Ii4uLiJ9
```

Query parameters:
- `limit` - Items per page (default: 20, max: 100)
- `cursor` - Pagination cursor from previous response
- `ascending` - Sort ascending by sequence (default: false)
- `archived` - Include archived entities (default: false)
- `deleted` - Include deleted entities (default: false)

### Modeling

FabricModel provides a standard vocabulary for entities. All fields are optional except `id` and `model`, enabling high reuse across different entity types.

```typescript
import type { FabricModel } from "@jaypie/fabric";

const record: FabricModel = {
  // Identity (required)
  id: "550e8400-e29b-41d4-a716-446655440000",
  model: "record",

  // Identity (optional)
  name: "December 12, 2026 Session",      // Full name, first reference
  label: "December 12",                    // Short name, second reference
  abbreviation: "12/12",                   // Shortest form
  alias: "2026-12-12",                     // Slug for human lookup
  xid: "external-system-id",               // External identifier
  description: "Daily session notes",

  // Schema
  class: "memory",                         // Category (varies by model)
  type: "session",                         // Type (varies by model)

  // Content
  content: "Session notes here...",
  metadata: { tags: ["work", "planning"] },

  // Display
  emoji: "📝",
  icon: "lucide#notebook",

  // Timestamps
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,                        // Set when archived
  deletedAt: null,                         // Set when soft-deleted
};
```

#### Specialized Models

**FabricJob** extends FabricModel for async tasks:

```typescript
import type { FabricJob } from "@jaypie/fabric";

const job: FabricJob = {
  id: "job-123",
  model: "job",
  status: "processing",                    // Required: current state
  startedAt: new Date(),
  completedAt: null,
  progress: {                              // FabricProgress (value object)
    percentageComplete: 45,
    elapsedTime: 12000,
    estimatedTime: 30000,
  },
  messages: [],                            // Execution log
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

**FabricMessage** extends FabricModel for content-focused entities:

```typescript
import type { FabricMessage } from "@jaypie/fabric";

const message: FabricMessage = {
  id: "msg-456",
  model: "message",
  content: "Hello, world!",                // Required
  type: "user",                            // e.g., "user", "assistant", "system"
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

#### Indexing

When persisting models to DynamoDB, use index utilities to build GSI keys:

```typescript
import { APEX, calculateScope, populateIndexKeys, DEFAULT_INDEXES } from "@jaypie/fabric";

// Root-level entity
const record = {
  model: "record",
  scope: APEX,                                // "@" for root level
  alias: "2026-12-12",
  sequence: Date.now(),
  // ...other fields
};

// Child entity (belongs to a parent)
const message = {
  model: "message",
  scope: calculateScope({ model: "chat", id: "chat-123" }),  // "chat#chat-123"
  sequence: Date.now(),
  // ...other fields
};

// Auto-populate GSI keys
const indexed = populateIndexKeys(record, DEFAULT_INDEXES);
// indexed.indexScope = "@#record"
// indexed.indexAlias = "@#record#2026-12-12"
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
| `resolveFromArray` | Extract from single-element array |
| `fabricObject` | Wrap in `{ value: ... }` |
| `resolveFromObject` | Extract `.value` from object |
| `fabricDate` | Convert to Date |
| `resolveFromDate` | Resolve from Date to string |
| `FabricModel` | Base type for models |
| `FabricMessage` | Message model type |
| `FabricJob` | Job model type |
| `FabricProgress` | Progress tracking type |
| `registerModel` | Register custom indexes for a model |
| `getModelIndexes` | Get indexes for a model |
| `populateIndexKeys` | Populate GSI keys on an entity |
| `buildCompositeKey` | Build composite key from fields |
| `calculateScope` | Calculate scope |
| `DEFAULT_INDEXES` | Default GSI indexes |
| `APEX` | Root-level marker (`"@"`) |
| `SEPARATOR` | Composite key separator (`"#"`) |
| `ARCHIVED_SUFFIX` | Suffix for archived entities |
| `DELETED_SUFFIX` | Suffix for deleted entities |

### Sub-Exports

| Path | Description |
|------|-------------|
| `@jaypie/fabric/commander` | Commander.js CLI adapter |
| `@jaypie/fabric/data` | DynamoDB CRUD service generator |
| `@jaypie/fabric/express` | Express middleware adapter |
| `@jaypie/fabric/http` | HTTP adapter with authorization and CORS |
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
