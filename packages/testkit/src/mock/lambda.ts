import { createMockFunction } from "./utils";
import { jaypieHandler } from "./core";

// We'll use more specific types instead of Function
type HandlerFunction = (...args: unknown[]) => unknown;
type LifecycleFunction = (...args: unknown[]) => unknown | Promise<unknown>;

export interface LambdaOptions {
  name?: string;
  setup?: LifecycleFunction | LifecycleFunction[];
  teardown?: LifecycleFunction | LifecycleFunction[];
  throw?: boolean;
  unavailable?: boolean;
  validate?: LifecycleFunction | LifecycleFunction[];
  [key: string]: unknown;
}

// Mock implementation of lambdaHandler that follows the original implementation pattern
export const lambdaHandler = createMockFunction<
  (handler: HandlerFunction, props?: LambdaOptions) => HandlerFunction
>((handler, props = {}) => {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof props === "function") {
    const temp = handler;
    handler = props;
    props = temp;
  }
  return async (event: unknown, context: unknown, ...extra: unknown[]) => {
    return jaypieHandler(handler, props)(event, context, ...extra);
  };
});

// Mock stream handler function type
type StreamHandlerFunction = (
  event: unknown,
  responseStream: { write: (data: string) => void; end: () => void },
  context: unknown,
  ...extra: unknown[]
) => Promise<void>;

// Mock implementation of lambdaStreamHandler
export const lambdaStreamHandler = createMockFunction<
  (
    handler: StreamHandlerFunction,
    props?: LambdaOptions,
  ) => StreamHandlerFunction
>((handler, props = {}) => {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof props === "function") {
    const temp = handler;
    handler = props;
    props = temp;
  }
  return async (
    event: unknown,
    responseStream: { write: (data: string) => void; end: () => void },
    context: unknown,
    ...extra: unknown[]
  ) => {
    try {
      await handler(event, responseStream, context, ...extra);
    } finally {
      try {
        responseStream.end();
      } catch {
        // Response stream may already be ended
      }
    }
  };
});
