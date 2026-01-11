// Type definitions for @jaypie/vocabulary/lambda

import type { Message, ServiceHandlerFunction } from "../types.js";

/** Callback called when handler completes successfully */
export type OnCompleteCallback = (response: unknown) => void | Promise<void>;

/** Callback called for recoverable errors (via context.onError) */
export type OnErrorCallback = (error: unknown) => void | Promise<void>;

/** Callback called for fatal errors (thrown or via context.onFatal) */
export type OnFatalCallback = (error: unknown) => void | Promise<void>;

/** Callback for receiving messages from service during execution */
export type OnMessageCallback = (message: Message) => void | Promise<void>;

// Re-export from @jaypie/lambda for convenience
export interface LambdaContext {
  awsRequestId?: string;
  [key: string]: unknown;
}

type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;
type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;

/**
 * Options for lambdaServiceHandler
 */
export interface LambdaServiceHandlerOptions {
  /** Chaos testing mode */
  chaos?: string;
  /** Override the handler name for logging (defaults to handler.alias) */
  name?: string;
  /** Callback called when handler completes successfully */
  onComplete?: OnCompleteCallback;
  /** Callback for recoverable errors (via context.onError) */
  onError?: OnErrorCallback;
  /** Callback for fatal errors (thrown or via context.onFatal) */
  onFatal?: OnFatalCallback;
  /** Callback for receiving messages from service during execution */
  onMessage?: OnMessageCallback;
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
