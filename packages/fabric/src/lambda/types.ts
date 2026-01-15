// Type definitions for @jaypie/fabric/lambda

import type {
  InputFieldDefinition,
  Message,
  Service,
  ServiceFunction,
} from "../types.js";

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

type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;
type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Options for fabricLambda
 */
export interface FabricLambdaOptions {
  /** Chaos testing mode */
  chaos?: string;
  /** Override the service name for logging (defaults to service.alias) */
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
 * Configuration for fabricLambda
 *
 * Supports two patterns:
 * 1. Pre-instantiated service: `{ service: myService }`
 * 2. Inline service definition: `{ alias, description, input, service: (input) => result }`
 *
 * When passing a pre-instantiated Service, `alias`, `description`, and `input` act as overrides.
 */
export interface FabricLambdaConfig extends FabricLambdaOptions {
  /** Service alias (used as name for logging if `name` not provided) - for inline or override */
  alias?: string;
  /** Service description - for inline or override */
  description?: string;
  /** Input field definitions - for inline service or override */
  input?: Record<string, InputFieldDefinition>;
  /** The service - either a pre-instantiated Service or an inline function */
  service: Service | ServiceFunction<Record<string, unknown>, unknown>;
}

/**
 * The returned Lambda handler function
 */
export type FabricLambdaResult<TResult = unknown> = (
  event: unknown,
  context?: LambdaContext,
  ...args: unknown[]
) => Promise<TResult> | TResult;
