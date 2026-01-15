// Type definitions for Commander adapter

import type { Command, Option } from "commander";

import type { InputFieldDefinition, Message, Service } from "../types.js";

/**
 * Callback function called when the command completes successfully
 * @param response - The return value from the service
 */
export type OnCompleteCallback = (response: unknown) => void | Promise<void>;

/**
 * Callback function called when the command encounters an error
 * @param error - The error that occurred
 */
export type OnErrorCallback = (error: unknown) => void | Promise<void>;

/**
 * Callback function called when the command encounters a fatal error
 * Fatal errors are unrecoverable and typically should terminate the process
 * @param error - The fatal error that occurred
 */
export type OnFatalCallback = (error: unknown) => void | Promise<void>;

/**
 * Callback function called to report progress messages during execution
 * @param message - Message object with level and message text
 */
export type OnMessageCallback = (message: Message) => void | Promise<void>;

/**
 * Override configuration for a specific option
 */
export interface CommanderOptionOverride {
  /** Override the description */
  description?: string;
  /** Override the flags (e.g., "-f, --foo <value>") */
  flags?: string;
  /** Hide from help output */
  hidden?: boolean;
  /** Override the long flag name */
  long?: string;
  /** Override the short flag */
  short?: string;
}

/**
 * Options for createCommanderOptions
 */
export interface CreateCommanderOptionsConfig {
  /** Field names to exclude from options */
  exclude?: string[];
  /** Per-field overrides */
  overrides?: Record<string, CommanderOptionOverride>;
}

/**
 * Options for parseCommanderOptions
 */
export interface ParseCommanderOptionsConfig {
  /** Field names to exclude from parsing */
  exclude?: string[];
  /** Input field definitions to use for type conversion */
  input?: Record<string, InputFieldDefinition>;
}

/**
 * Result from createCommanderOptions
 */
export interface CreateCommanderOptionsResult {
  /** Array of Commander Option objects */
  options: Option[];
}

/**
 * Configuration for fabricCommand
 */
export interface FabricCommandConfig {
  /** Override the command description (defaults to service.description) */
  description?: string;
  /** Field names to exclude from options */
  exclude?: string[];
  /** Override the command name (defaults to service.alias) */
  name?: string;
  /** Callback called when command completes successfully */
  onComplete?: OnCompleteCallback;
  /** Callback called when command encounters an error */
  onError?: OnErrorCallback;
  /** Callback called when command encounters a fatal error (unrecoverable) */
  onFatal?: OnFatalCallback;
  /** Callback called to report progress messages */
  onMessage?: OnMessageCallback;
  /** Per-field overrides */
  overrides?: Record<string, CommanderOptionOverride>;
  /** The Commander program or command to register on */
  program: Command;
  /** The service to register */
  service: Service;
}

/**
 * Result from fabricCommand
 */
export interface FabricCommandResult {
  /** The created command */
  command: Command;
  /** The message callback, returned for external use (e.g., emitting progress messages) */
  onMessage?: OnMessageCallback;
}
