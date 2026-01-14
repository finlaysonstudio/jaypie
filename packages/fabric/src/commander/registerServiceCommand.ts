// Register a service as a Commander command

import type { Message, ServiceContext } from "../types.js";
import type {
  RegisterServiceCommandConfig,
  RegisterServiceCommandResult,
} from "./types.js";
import { createCommanderOptions } from "./createCommanderOptions.js";
import { parseCommanderOptions } from "./parseCommanderOptions.js";

/**
 * Register a service as a Commander.js command
 *
 * This function creates a command from a service, automatically:
 * - Creating the command with the handler's alias (or custom name)
 * - Adding a description from the handler's description (or custom)
 * - Converting input definitions to Commander options
 * - Wiring up the action to call the handler with parsed input
 *
 * Error handling:
 * - Services can call context.onError() for recoverable errors
 * - Services can call context.onFatal() for fatal errors
 * - Any error that throws out of the service is treated as fatal
 *
 * @param config - Configuration including handler, program, and optional overrides
 * @returns An object containing the created command
 *
 * @example
 * ```typescript
 * import { Command } from "commander";
 * import { createService } from "@jaypie/fabric";
 * import { registerServiceCommand } from "@jaypie/fabric/commander";
 *
 * const handler = createService({
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
  onComplete,
  onError,
  onFatal,
  onMessage,
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

    // Create context callbacks that wrap the registration callbacks with error swallowing
    // Callback failures should never halt service execution
    const sendMessage = onMessage
      ? async (message: Message): Promise<void> => {
          try {
            await onMessage(message);
          } catch {
            // Swallow errors - messaging failures should not halt execution
          }
        }
      : undefined;

    const contextOnError = onError
      ? async (error: unknown): Promise<void> => {
          try {
            await onError(error);
          } catch {
            // Swallow errors - callback failures should not halt execution
          }
        }
      : undefined;

    const contextOnFatal = onFatal
      ? async (error: unknown): Promise<void> => {
          try {
            await onFatal(error);
          } catch {
            // Swallow errors - callback failures should not halt execution
          }
        }
      : undefined;

    // Create context for the service
    const context: ServiceContext = {
      onError: contextOnError,
      onFatal: contextOnFatal,
      sendMessage,
    };

    try {
      // Call the handler with context
      const response = await handler(input, context);

      // Call onComplete callback if provided
      if (onComplete) {
        await onComplete(response);
      }
    } catch (error) {
      // Any error that escapes the service is treated as fatal
      // Services should catch recoverable errors and call context.onError() explicitly
      if (onFatal) {
        await onFatal(error);
      } else if (onError) {
        // Fall back to onError if onFatal not provided
        await onError(error);
      } else {
        // No error callbacks provided, re-throw
        throw error;
      }
    }
  });

  return { command, onMessage };
}
