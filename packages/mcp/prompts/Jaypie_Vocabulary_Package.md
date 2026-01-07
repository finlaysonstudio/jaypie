---
description: Complete guide to using Jaypie Vocabulary for type coercion, service handlers, and Commander CLI integration
---

# Jaypie Vocabulary Package

Jaypie Vocabulary (`@jaypie/vocabulary`) provides type coercion utilities and service handler patterns for consistent input handling across Jaypie applications. It includes adapters for integrating service handlers with Commander.js CLIs.

## Installation

```bash
npm install @jaypie/vocabulary
# For CLI integration:
npm install commander
```

## Core Concepts

### Design Philosophy

Vocabulary follows the "Fabric" philosophy:
- **Smooth, pliable** - Things that feel right should work
- **Catch bad passes** - Invalid inputs throw clear errors

This means `"true"` works where `true` is expected, `"42"` works where `42` is expected, and invalid conversions fail fast with `BadRequestError`.

## serviceHandler

Factory function that creates validated service endpoints with automatic type coercion.

### Basic Usage

```typescript
import { serviceHandler } from "@jaypie/vocabulary";

const divisionHandler = serviceHandler({
  alias: "division",
  description: "Divides two numbers",
  input: {
    numerator: {
      type: Number,
      default: 12,
      description: "Number on top",
    },
    denominator: {
      type: Number,
      default: 3,
      description: "Number on bottom",
      validate: (value) => value !== 0,
    },
  },
  service: ({ numerator, denominator }) => numerator / denominator,
});

await divisionHandler();                              // → 4
await divisionHandler({ numerator: 24 });             // → 8
await divisionHandler({ numerator: "14", denominator: "7" }); // → 2 (coerced)
await divisionHandler('{"numerator": "18"}');         // → 6 (JSON parsed)
```

### Handler Properties

Config properties are attached directly to the handler for introspection:

```typescript
const handler = serviceHandler({
  alias: "greet",
  description: "Greet a user",
  input: { name: { type: String } },
  service: ({ name }) => `Hello, ${name}!`,
});

handler.alias;       // "greet"
handler.description; // "Greet a user"
handler.input;       // { name: { type: String } }
```

### Input Field Definition

| Property | Type | Description |
|----------|------|-------------|
| `type` | `CoercionType` | Required. The target type for coercion |
| `default` | `unknown` | Default value if not provided |
| `description` | `string` | Field description (used in CLI help) |
| `required` | `boolean` | Whether field is required (default: true unless default set) |
| `validate` | `function \| RegExp \| array` | Validation after coercion |
| `flag` | `string` | Override long flag name for Commander.js |
| `letter` | `string` | Short switch letter for Commander.js |

### Validation-Only Mode

When no `service` function is provided, the handler returns the processed input:

```typescript
const validateUser = serviceHandler({
  input: {
    age: { type: Number, validate: (v) => v >= 18 },
    email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
    role: { type: ["admin", "user", "guest"], default: "user" },
  },
});

await validateUser({ age: "25", email: "bob@example.com" });
// → { age: 25, email: "bob@example.com", role: "user" }
```

## Type Coercion

### Supported Types

| Type | Aliases | Description |
|------|---------|-------------|
| `String` | `"string"`, `""` | String coercion |
| `Number` | `"number"` | Number coercion |
| `Boolean` | `"boolean"` | Boolean coercion |
| `Array` | `"array"`, `[]` | Array coercion |
| `Object` | `"object"`, `{}` | Object coercion |
| `[String]` | `[""]` | Typed array of strings |
| `[Number]` | - | Typed array of numbers |
| `[Boolean]` | - | Typed array of booleans |
| `[Object]` | `[{}]` | Typed array of objects |
| `/regex/` | - | String with regex validation |
| `["a", "b"]` | - | Validated string (must match) |
| `[1, 2, 3]` | - | Validated number (must match) |

### Coercion Examples

```typescript
import { coerce } from "@jaypie/vocabulary";

// Boolean coercion
coerce("true", Boolean);     // → true
coerce("false", Boolean);    // → false
coerce(1, Boolean);          // → true
coerce(0, Boolean);          // → false

// Number coercion
coerce("42", Number);        // → 42
coerce("true", Number);      // → 1
coerce("false", Number);     // → 0

// String coercion
coerce(true, String);        // → "true"
coerce(42, String);          // → "42"

// Array coercion
coerce("1,2,3", [Number]);   // → [1, 2, 3]
coerce("a\tb\tc", [String]); // → ["a", "b", "c"]
coerce([1, 2], [String]);    // → ["1", "2"]

// Unwrapping
coerce({ value: "42" }, Number);  // → 42
coerce(["true"], Boolean);        // → true
coerce('{"value": 5}', Number);   // → 5
```

### RegExp Type Shorthand

A bare RegExp coerces to String and validates:

```typescript
const handler = serviceHandler({
  input: {
    email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
  },
  service: ({ email }) => email,
});

await handler({ email: "bob@example.com" });  // ✓
await handler({ email: "invalid" });          // ✗ BadRequestError
```

### Validated Type Shorthand

Arrays of literals validate against allowed values:

```typescript
// String validation
input: {
  currency: { type: ["usd", "eur", "gbp"] },  // Must be one of these
  pattern: { type: [/^test-/, "special"] },   // Matches regex OR equals "special"
}

// Number validation
input: {
  priority: { type: [1, 2, 3, 4, 5] },        // Must be 1-5
}
```

## Commander.js Integration

### registerServiceCommand (Recommended)

The simplest way to register a service handler as a Commander command:

```typescript
import { Command } from "commander";
import { serviceHandler } from "@jaypie/vocabulary";
import { registerServiceCommand } from "@jaypie/vocabulary/commander";

const handler = serviceHandler({
  alias: "greet",
  description: "Greet a user",
  input: {
    userName: { type: String, flag: "user", letter: "u" },
    loud: { type: Boolean, letter: "l", default: false },
  },
  service: ({ loud, userName }) => {
    const greeting = `Hello, ${userName}!`;
    console.log(loud ? greeting.toUpperCase() : greeting);
  },
});

const program = new Command();
registerServiceCommand({ handler, program });
program.parse();
// Usage: greet --user Alice -l
// Output: HELLO, ALICE!
```

### registerServiceCommand Options

| Option | Type | Description |
|--------|------|-------------|
| `handler` | `ServiceHandlerFunction` | Required. The service handler |
| `program` | `Command` | Required. Commander program or command |
| `name` | `string` | Override command name (default: handler.alias) |
| `description` | `string` | Override description (default: handler.description) |
| `exclude` | `string[]` | Field names to exclude from options |
| `onComplete` | `OnCompleteCallback` | Called with handler's return value on success |
| `onError` | `OnErrorCallback` | Called when handler throws (prevents re-throw if provided) |
| `onMessage` | `OnMessageCallback` | Returned in result for external progress reporting |
| `overrides` | `Record<string, override>` | Per-field option overrides |

### registerServiceCommand with Callbacks

Services can send messages during execution via the `context.sendMessage` function, which connects to `onMessage`:

```typescript
import { Command } from "commander";
import { serviceHandler } from "@jaypie/vocabulary";
import { registerServiceCommand } from "@jaypie/vocabulary/commander";

const handler = serviceHandler({
  alias: "evaluate",
  input: { jobId: { type: String } },
  service: async ({ jobId }, context) => {
    // Service can send progress messages via context
    context?.sendMessage?.({ message: `Starting job ${jobId}` });

    // Run evaluation...
    context?.sendMessage?.({ level: "debug", message: "Processing..." });

    return { jobId, status: "complete", results: 42 };
  },
});

const program = new Command();
registerServiceCommand({
  handler,
  program,
  onComplete: (response) => {
    console.log("Done:", JSON.stringify(response, null, 2));
  },
  onError: (error) => {
    console.error("Failed:", error);
    process.exit(1);
  },
  onMessage: (msg) => {
    // Receives messages from context.sendMessage
    // msg: { level?: "trace"|"debug"|"info"|"warn"|"error", message: string }
    console[msg.level || "info"](msg.message);
  },
});

program.parse();
```

**Note:** Errors in `onMessage` are swallowed to ensure messaging failures never halt service execution.

### Input Flag and Letter Properties

Define CLI flags directly in input definitions:

```typescript
input: {
  userName: {
    type: String,
    flag: "user",     // Long flag: --user (instead of --user-name)
    letter: "u",      // Short flag: -u
    description: "User name to greet",
  },
  verbose: {
    type: Boolean,
    letter: "v",      // -v
  },
}
// Generates: --user <userName>, -u and --verbose, -v
```

### Manual Integration

For more control, use `createCommanderOptions` and `parseCommanderOptions`:

```typescript
import { Command } from "commander";
import { serviceHandler } from "@jaypie/vocabulary";
import {
  createCommanderOptions,
  parseCommanderOptions,
} from "@jaypie/vocabulary/commander";

const handler = serviceHandler({
  input: {
    userName: { type: String, description: "User name" },
    maxRetries: { type: Number, default: 3 },
    verbose: { type: Boolean },
  },
  service: (input) => console.log(input),
});

const program = new Command();

// Create options from handler input
const { options } = createCommanderOptions(handler.input, {
  exclude: ["internalField"],
  overrides: {
    userName: { short: "u", description: "Override description" },
  },
});
options.forEach((opt) => program.addOption(opt));

// Wire up action
program.action(async (opts) => {
  const input = parseCommanderOptions(opts, { input: handler.input });
  await handler(input);
});

program.parse();
```

### Boolean Flag Behavior

Commander.js automatically handles boolean flags:
- `--verbose` sets to `true`
- `--no-verbose` sets to `false` (for flags with `default: true`)

## Complete CLI Example

```typescript
// src/commands/evaluate.ts
import { Command } from "commander";
import { serviceHandler } from "@jaypie/vocabulary";
import { registerServiceCommand } from "@jaypie/vocabulary/commander";

export const evaluateHandler = serviceHandler({
  alias: "evaluate",
  description: "Run an evaluation job",
  input: {
    jobId: {
      type: String,
      flag: "job",
      letter: "j",
      description: "Job identifier",
    },
    priority: {
      type: [1, 2, 3, 4, 5],
      default: 3,
      letter: "p",
      description: "Job priority (1-5)",
    },
    tags: {
      type: [String],
      letter: "t",
      required: false,
      description: "Tags to apply",
    },
    dryRun: {
      type: Boolean,
      letter: "d",
      default: false,
      description: "Run without executing",
    },
  },
  service: async ({ dryRun, jobId, priority, tags }) => {
    console.log(`Running job ${jobId} with priority ${priority}`);
    if (tags?.length) console.log(`Tags: ${tags.join(", ")}`);
    if (dryRun) {
      console.log("(dry run - no changes made)");
      return;
    }
    // Execute job...
  },
});

export function evaluateCommand(program: Command): Command {
  registerServiceCommand({ handler: evaluateHandler, program });
  return program;
}
```

Usage:
```bash
# Required job, default priority
cli evaluate --job abc123

# With all options
cli evaluate -j abc123 -p 1 -t urgent -t critical --dry-run

# Help
cli evaluate --help
```

## TypeScript Types

```typescript
import type {
  // Message types
  Message,
  MessageLevel,

  // Coercion types
  CoercionType,
  ScalarType,
  CompositeType,
  TypedArrayType,
  ValidatedStringType,
  ValidatedNumberType,
  RegExpType,
  ArrayElementType,

  // Service handler types
  InputFieldDefinition,
  ServiceContext,
  ServiceFunction,
  ServiceHandlerConfig,
  ServiceHandlerFunction,
  ValidateFunction,
} from "@jaypie/vocabulary";

import type {
  // Commander adapter types
  CommanderOptionOverride,
  CreateCommanderOptionsConfig,
  CreateCommanderOptionsResult,
  OnCompleteCallback,
  OnErrorCallback,
  OnMessageCallback,
  ParseCommanderOptionsConfig,
  RegisterServiceCommandConfig,
  RegisterServiceCommandResult,
} from "@jaypie/vocabulary/commander";
```

### Message Type

Standard message structure for callbacks and notifications:

```typescript
type MessageLevel = "trace" | "debug" | "info" | "warn" | "error";

interface Message {
  level?: MessageLevel;  // Defaults to "info" if not specified
  message: string;
}
```

### ServiceContext Type

Context passed to service functions for callbacks and utilities:

```typescript
interface ServiceContext {
  sendMessage?: (message: Message) => void | Promise<void>;
}
```

Services receive context as an optional second parameter and can use `sendMessage` to emit progress messages that connect to `onMessage` in `registerServiceCommand`.

## Exports

### Main Export (`@jaypie/vocabulary`)

```typescript
// Coercion functions
export {
  coerce,
  coerceFromArray,
  coerceFromObject,
  coerceToArray,
  coerceToBoolean,
  coerceToNumber,
  coerceToObject,
  coerceToString,
} from "./coerce.js";

// Service Handler
export { serviceHandler } from "./serviceHandler.js";

// Commander namespace
export * as commander from "./commander/index.js";

// Types (including Message vocabulary and ServiceContext)
export type { Message, MessageLevel, ServiceContext } from "./types.js";

// Version
export const VOCABULARY_VERSION: string;
```

### Commander Export (`@jaypie/vocabulary/commander`)

```typescript
export { createCommanderOptions } from "./createCommanderOptions.js";
export { parseCommanderOptions } from "./parseCommanderOptions.js";
export { registerServiceCommand } from "./registerServiceCommand.js";

// Callback types
export type { OnCompleteCallback, OnErrorCallback, OnMessageCallback } from "./types.js";
```

## Error Handling

Invalid coercions throw `BadRequestError` from `@jaypie/errors`:

```typescript
import { BadRequestError } from "@jaypie/errors";

// These throw BadRequestError:
await handler({ numerator: "not-a-number" });  // Cannot coerce to Number
await handler({ priority: 10 });                // Validation fails (not in [1,2,3,4,5])
await handler({});                              // Missing required field
```

## Integration with Other Packages

Vocabulary is designed to be consumed by:
- **`@jaypie/lambda`** - Lambda handler input processing
- **`@jaypie/express`** - Express route input validation
- **CLI packages** - Commander.js integration via the commander adapter
