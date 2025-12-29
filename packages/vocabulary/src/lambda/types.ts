// Type definitions for @jaypie/vocabulary/lambda

import type { ServiceHandlerFunction } from "../types.js";

// Re-export from @jaypie/lambda for convenience
export interface LambdaContext {
  awsRequestId?: string;
  [key: string]: unknown;
}

type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;
type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;

/**
 * Options for lambdaServiceHandler
 * Same as LambdaHandlerOptions but excludes 'name' since we use handler.alias
 */
export interface LambdaServiceHandlerOptions {
  /** Chaos testing mode */
  chaos?: string;
  /** Override the handler name for logging (defaults to handler.alias) */
  name?: string;
  /** AWS secrets to load into process.env */
  secrets?: string[];
  /** Functions to run before handler */
  setup?: LifecycleFunction[];
  /** Functions to run after handler (always runs) */
  teardown?: LifecycleFunction[];
  /** Re-throw errors instead of returning error response */
  throw?: boolean;
  /** Return 503 Unavailable immediately */
  unavailable?: boolean;
  /** Validation functions to run before handler */
  validate?: ValidatorFunction[];
}

/**
 * Configuration for lambdaServiceHandler
 */
export interface LambdaServiceHandlerConfig extends LambdaServiceHandlerOptions {
  /** The service handler function to wrap */
  handler: ServiceHandlerFunction;
}

/**
 * The returned Lambda handler function
 */
export type LambdaServiceHandlerResult<TResult = unknown> = (
  event: unknown,
  context?: LambdaContext,
  ...args: unknown[]
) => Promise<TResult> | TResult;
