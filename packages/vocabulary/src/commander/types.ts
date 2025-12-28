// Type definitions for Commander adapter

import type { Command, Option } from "commander";

import type { InputFieldDefinition, ServiceHandlerFunction } from "../types.js";

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
  /** Input field definitions to use for type coercion */
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
 * Configuration for registerServiceCommand
 */
export interface RegisterServiceCommandConfig {
  /** Override the command description (defaults to handler.description) */
  description?: string;
  /** Field names to exclude from options */
  exclude?: string[];
  /** The service handler to register */
  handler: ServiceHandlerFunction;
  /** Override the command name (defaults to handler.alias) */
  name?: string;
  /** Per-field overrides */
  overrides?: Record<string, CommanderOptionOverride>;
  /** The Commander program or command to register on */
  program: Command;
}

/**
 * Result from registerServiceCommand
 */
export interface RegisterServiceCommandResult {
  /** The created command */
  command: Command;
}
