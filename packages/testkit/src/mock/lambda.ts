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
