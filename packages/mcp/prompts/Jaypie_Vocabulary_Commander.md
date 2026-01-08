---
description: Commander.js CLI integration with serviceHandler callbacks (onMessage, onComplete, onError, onFatal)
include: "**/cli/**"
---

# Jaypie Vocabulary Commander Adapter

The Commander adapter (`@jaypie/vocabulary/commander`) integrates Jaypie service handlers with Commander.js CLI applications, providing automatic option generation, type coercion, and callback hooks for progress reporting.

**See also:** [Jaypie_Vocabulary_Package.md](Jaypie_Vocabulary_Package.md) for core serviceHandler documentation.

## Installation

```bash
npm install @jaypie/vocabulary commander
```

## Quick Start

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
```

## registerServiceCommand

The primary function for registering a service handler as a Commander command.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `handler` | `ServiceHandlerFunction` | Required. The service handler to register |
| `program` | `Command` | Required. Commander program or command |
| `name` | `string` | Override command name (default: handler.alias) |
| `description` | `string` | Override description (default: handler.description) |
| `exclude` | `string[]` | Field names to exclude from CLI options |
| `onComplete` | `OnCompleteCallback` | Called with handler's return value on success |
| `onError` | `OnErrorCallback` | Receives errors reported via `context.onError()` |
| `onFatal` | `OnFatalCallback` | Receives fatal errors (thrown or via `context.onFatal()`) |
| `onMessage` | `OnMessageCallback` | Receives messages from `context.sendMessage` |
| `overrides` | `Record<string, override>` | Per-field option overrides |

## Callback Hooks

### onMessage

Receives progress messages sent by the service via `context.sendMessage`:

```typescript
import { Command } from "commander";
import { serviceHandler } from "@jaypie/vocabulary";
import { registerServiceCommand } from "@jaypie/vocabulary/commander";

const handler = serviceHandler({
  alias: "process",
  input: { jobId: { type: String, letter: "j" } },
  service: async ({ jobId }, context) => {
    // Send progress messages during execution
    context?.sendMessage?.({ content: `Starting job ${jobId}` });

    // Simulate work
    await doStep1();
    context?.sendMessage?.({ content: "Step 1 complete", level: "debug" });

    await doStep2();
    context?.sendMessage?.({ content: "Step 2 complete", level: "debug" });

    context?.sendMessage?.({ content: "Job finished!", level: "info" });
    return { jobId, status: "complete" };
  },
});

const program = new Command();
registerServiceCommand({
  handler,
  program,
  onMessage: (msg) => {
    // msg: { content: string, level?: "trace"|"debug"|"info"|"warn"|"error" }
    const level = msg.level || "info";
    console[level](msg.content);
  },
});
program.parse();
```

**Important:** Errors in `onMessage` are swallowed to ensure messaging failures never halt service execution.

### onComplete

Called with the handler's return value on successful completion:

```typescript
registerServiceCommand({
  handler,
  program,
  onComplete: (response) => {
    // Called after service completes successfully
    console.log("Result:", JSON.stringify(response, null, 2));

    // Common patterns:
    // - Save results to file
    // - Display formatted output
    // - Trigger follow-up actions
  },
});
```

### onError

Receives errors that the service explicitly reports via `context.onError()`. Use this for recoverable errors that don't halt execution:

```typescript
registerServiceCommand({
  handler,
  program,
  onError: (error) => {
    // Log recoverable errors
    console.warn("Warning:", error.message);
  },
});
```

### onFatal

Receives fatal errors - either thrown errors or errors reported via `context.onFatal()`. Any error that escapes the service (is thrown) is treated as fatal:

```typescript
registerServiceCommand({
  handler,
  program,
  onFatal: (error) => {
    console.error("Fatal error:", error.message);
    process.exit(1);
  },
});
```

**Error handling priority:**
1. If `onFatal` is provided, thrown errors go to `onFatal`
2. If only `onError` is provided, thrown errors fall back to `onError`
3. If neither is provided, errors are re-thrown

## Complete Example with All Callbacks

```typescript
import { Command } from "commander";
import { serviceHandler } from "@jaypie/vocabulary";
import { registerServiceCommand } from "@jaypie/vocabulary/commander";

const evaluateHandler = serviceHandler({
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
  service: async ({ dryRun, jobId, priority, tags }, context) => {
    context?.sendMessage?.({ content: `Initializing job ${jobId}...` });

    if (dryRun) {
      context?.sendMessage?.({ content: "Dry run mode - skipping execution", level: "warn" });
      return { jobId, status: "dry-run", skipped: true };
    }

    // Handle recoverable errors without throwing
    try {
      await riskyOperation();
    } catch (err) {
      context?.onError?.(err);  // Reports error but continues
    }

    context?.sendMessage?.({ content: `Running with priority ${priority}` });

    if (tags?.length) {
      context?.sendMessage?.({ content: `Applying tags: ${tags.join(", ")}`, level: "debug" });
    }

    // Simulate processing
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      context?.sendMessage?.({ content: `Progress: ${i * 20}%`, level: "debug" });
    }

    context?.sendMessage?.({ content: "Evaluation complete!" });
    return { jobId, status: "complete", results: 42 };
  },
});

const program = new Command();
program.version("1.0.0").description("Evaluation CLI");

registerServiceCommand({
  handler: evaluateHandler,
  program,
  onMessage: (msg) => {
    const prefix = msg.level === "warn" ? "WARNING: " :
                   msg.level === "error" ? "ERROR: " : "";
    console.log(`${prefix}${msg.content}`);
  },
  onComplete: (response) => {
    console.log("\n--- Results ---");
    console.log(JSON.stringify(response, null, 2));
  },
  onError: (error) => {
    // Recoverable errors reported via context.onError()
    console.warn("Warning:", error.message);
  },
  onFatal: (error) => {
    // Fatal errors (thrown or via context.onFatal())
    console.error("\nFatal:", error.message);
    process.exit(1);
  },
});

program.parse();
```

Usage:
```bash
# Basic execution
cli evaluate --job abc123

# With all options
cli evaluate -j abc123 -p 1 -t urgent -t critical --dry-run

# Help
cli evaluate --help
```

## Input Flag and Letter Properties

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

### Naming Convention

| Property | CLI Flag | Example |
|----------|----------|---------|
| `userName` (camelCase) | `--user-name` | Default behavior |
| `flag: "user"` | `--user` | Override long flag |
| `letter: "u"` | `-u` | Short flag |

## Boolean Flag Behavior

Commander.js automatically handles boolean flags:
- `--verbose` sets to `true`
- `--no-verbose` sets to `false` (for flags with `default: true`)

## Manual Integration

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

## TypeScript Types

```typescript
import type {
  CommanderOptionOverride,
  CreateCommanderOptionsConfig,
  CreateCommanderOptionsResult,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
  ParseCommanderOptionsConfig,
  RegisterServiceCommandConfig,
  RegisterServiceCommandResult,
} from "@jaypie/vocabulary/commander";
```

### Callback Type Definitions

```typescript
// Message received from context.sendMessage
interface Message {
  content: string;
  level?: "trace" | "debug" | "info" | "warn" | "error";
}

// onMessage callback
type OnMessageCallback = (message: Message) => void | Promise<void>;

// onComplete callback - receives handler return value
type OnCompleteCallback<T = unknown> = (response: T) => void | Promise<void>;

// onError callback - receives errors from context.onError()
type OnErrorCallback = (error: unknown) => void | Promise<void>;

// onFatal callback - receives fatal errors (thrown or context.onFatal())
type OnFatalCallback = (error: unknown) => void | Promise<void>;
```

## Exports

```typescript
// @jaypie/vocabulary/commander
export { createCommanderOptions } from "./createCommanderOptions.js";
export { parseCommanderOptions } from "./parseCommanderOptions.js";
export { registerServiceCommand } from "./registerServiceCommand.js";

export type {
  CommanderOptionOverride,
  CreateCommanderOptionsConfig,
  CreateCommanderOptionsResult,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
  ParseCommanderOptionsConfig,
  RegisterServiceCommandConfig,
  RegisterServiceCommandResult,
} from "./types.js";
```

## Related

- [Jaypie_Commander_CLI_Package.md](Jaypie_Commander_CLI_Package.md) - Setting up a Commander CLI project from scratch
- [Jaypie_Vocabulary_Package.md](Jaypie_Vocabulary_Package.md) - Core serviceHandler and type coercion
