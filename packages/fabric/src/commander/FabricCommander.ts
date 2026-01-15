// FabricCommander - Convenient wrapper for multi-command CLIs

import { Command } from "commander";

import type {
  InputFieldDefinition,
  Service,
  ServiceFunction,
} from "../types.js";
import { fabricCommand } from "./fabricCommand.js";
import type {
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "./types.js";

/**
 * Inline service definition for FabricCommander
 * Allows defining services directly in the services array
 */
export interface InlineServiceDefinition {
  /** Service alias (used as command name) */
  alias: string;
  /** Service description */
  description?: string;
  /** Input field definitions */
  input?: Record<string, InputFieldDefinition>;
  /** The service function */
  service: ServiceFunction<Record<string, unknown>, unknown>;
}

/**
 * Service entry - either a pre-instantiated Service or an inline definition
 */
export type ServiceEntry = Service | InlineServiceDefinition;

/**
 * Configuration for FabricCommander
 */
export interface FabricCommanderConfig {
  /** CLI description */
  description?: string;
  /** CLI name (defaults to process.argv script name) */
  name?: string;
  /** Default callback called when any command completes successfully */
  onComplete?: OnCompleteCallback;
  /** Default callback called when any command encounters an error */
  onError?: OnErrorCallback;
  /** Default callback called when any command encounters a fatal error */
  onFatal?: OnFatalCallback;
  /** Default callback called to report progress messages */
  onMessage?: OnMessageCallback;
  /** Services to register as commands */
  services: ServiceEntry[];
  /** CLI version */
  version?: string;
}

/**
 * Type guard to check if config is an array of services
 */
function isServicesArray(
  config: ServiceEntry[] | FabricCommanderConfig,
): config is ServiceEntry[] {
  return Array.isArray(config);
}

/**
 * Type guard to check if a service entry is an inline definition
 */
function isInlineDefinition(
  entry: ServiceEntry,
): entry is InlineServiceDefinition {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "alias" in entry &&
    "service" in entry &&
    !("$fabric" in entry)
  );
}

/**
 * FabricCommander - Convenient wrapper for creating multi-command CLIs
 *
 * Creates a Commander program with multiple service commands in a single call.
 *
 * @example
 * ```typescript
 * // Array form - simple list of services
 * const cli = new FabricCommander([greetService, farewellService]);
 * cli.parse();
 *
 * // Config form - with description and version
 * const cli = new FabricCommander({
 *   name: "my-cli",
 *   description: "My CLI application",
 *   version: "1.0.0",
 *   services: [greetService, farewellService],
 * });
 * cli.parse();
 *
 * // With inline service definitions
 * const cli = new FabricCommander({
 *   description: "My CLI",
 *   version: "1.0.0",
 *   services: [
 *     existingService,
 *     {
 *       alias: "greet",
 *       description: "Greet a user",
 *       input: { name: { type: String } },
 *       service: ({ name }) => `Hello, ${name}!`,
 *     },
 *   ],
 * });
 * cli.parse();
 * ```
 */
export class FabricCommander {
  /** The underlying Commander Command instance */
  public readonly command: Command;

  constructor(config: ServiceEntry[] | FabricCommanderConfig) {
    this.command = new Command();

    // Normalize config
    const normalizedConfig: FabricCommanderConfig = isServicesArray(config)
      ? { services: config }
      : config;

    const {
      description,
      name,
      onComplete,
      onError,
      onFatal,
      onMessage,
      services,
      version,
    } = normalizedConfig;

    // Set program metadata
    if (name) {
      this.command.name(name);
    }
    if (version) {
      this.command.version(version);
    }
    if (description) {
      this.command.description(description);
    }

    // Register each service as a command
    for (const entry of services) {
      if (isInlineDefinition(entry)) {
        // Inline service definition
        fabricCommand({
          alias: entry.alias,
          description: entry.description,
          input: entry.input,
          onComplete,
          onError,
          onFatal,
          onMessage,
          program: this.command,
          service: entry.service,
        });
      } else {
        // Pre-instantiated Service
        fabricCommand({
          onComplete,
          onError,
          onFatal,
          onMessage,
          program: this.command,
          service: entry,
        });
      }
    }
  }

  /**
   * Parse command-line arguments
   * Delegates to Commander's parse method
   */
  parse(argv?: readonly string[]): this {
    this.command.parse(argv);
    return this;
  }

  /**
   * Parse command-line arguments asynchronously
   * Delegates to Commander's parseAsync method
   */
  async parseAsync(argv?: readonly string[]): Promise<this> {
    await this.command.parseAsync(argv);
    return this;
  }
}
