import { HandlerOptions } from "@jaypie/core";

export interface LambdaContext {
  awsRequestId?: string;
  [key: string]: unknown;
}

export interface LambdaHandlerOptions extends HandlerOptions {
  name?: string;
  setup?: Array<(...args: unknown[]) => Promise<void> | void>;
  teardown?: Array<(...args: unknown[]) => Promise<void> | void>;
  unavailable?: boolean;
  validate?: Array<(...args: unknown[]) => Promise<boolean> | boolean>;
}

export type LambdaHandler<TEvent = unknown, TResult = unknown> = (
  event: TEvent,
  context?: LambdaContext,
  ...args: unknown[]
) => Promise<TResult> | TResult;

export function lambdaHandler<TEvent = unknown, TResult = unknown>(
  handlerOrOptions: LambdaHandler<TEvent, TResult> | LambdaHandlerOptions,
  optionsOrHandler?: LambdaHandlerOptions | LambdaHandler<TEvent, TResult>,
): LambdaHandler<TEvent, TResult>;
