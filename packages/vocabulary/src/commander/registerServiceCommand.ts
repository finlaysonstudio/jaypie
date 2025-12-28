// Register a serviceHandler as a Commander command

import type {
  RegisterServiceCommandConfig,
  RegisterServiceCommandResult,
} from "./types.js";
import { createCommanderOptions } from "./createCommanderOptions.js";
import { parseCommanderOptions } from "./parseCommanderOptions.js";

/**
 * Register a serviceHandler as a Commander.js command
 *
 * This function creates a command from a service handler, automatically:
 * - Creating the command with the handler's alias (or custom name)
 * - Adding a description from the handler's description (or custom)
 * - Converting input definitions to Commander options
 * - Wiring up the action to call the handler with parsed input
 *
 * @param config - Configuration including handler, program, and optional overrides
 * @returns An object containing the created command
 *
 * @example
 * ```typescript
 * import { Command } from "commander";
 * import { serviceHandler } from "@jaypie/vocabulary";
 * import { registerServiceCommand } from "@jaypie/vocabulary/commander";
 *
 * const handler = serviceHandler({
 *   alias: "greet",
 *   description: "Greet a user",
 *   input: {
 *     userName: { type: String, description: "User name" },
 *     loud: { type: Boolean, description: "Shout greeting" },
 *   },
 *   service: ({ userName, loud }) => {
 *     const greeting = `Hello, ${userName}!`;
 *     return loud ? greeting.toUpperCase() : greeting;
 *   },
 * });
 *
 * const program = new Command();
 * registerServiceCommand({ handler, program });
 * program.parse();
 * ```
 */
export function registerServiceCommand({
  description,
  exclude,
  handler,
  name,
  overrides,
  program,
}: RegisterServiceCommandConfig): RegisterServiceCommandResult {
  // Determine command name (priority: name > handler.alias > "command")
  const commandName = name ?? handler.alias ?? "command";

  // Determine command description (priority: description > handler.description)
  const commandDescription = description ?? handler.description;

  // Create the command
  const command = program.command(commandName);

  // Add description if available
  if (commandDescription) {
    command.description(commandDescription);
  }

  // Create and add options from handler input
  if (handler.input) {
    const { options } = createCommanderOptions(handler.input, {
      exclude,
      overrides,
    });
    options.forEach((opt) => command.addOption(opt));
  }

  // Wire up the action
  command.action(async (options): Promise<void> => {
    // Parse Commander options to handler input format
    const input = parseCommanderOptions(options, {
      exclude,
      input: handler.input,
    });

    // Call the handler
    await handler(input);
  });

  return { command };
}
