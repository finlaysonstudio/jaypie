import { createMockFunction } from "./utils";
import { BadRequestError, jaypieHandler } from "./core";

// We'll use more specific types instead of Function
type HandlerFunction = (...args: unknown[]) => unknown;
type LifecycleFunction = (...args: unknown[]) => unknown | Promise<unknown>;

interface LambdaOptions {
  name?: string;
  setup?: LifecycleFunction | LifecycleFunction[];
  teardown?: LifecycleFunction | LifecycleFunction[];
  throw?: boolean;
  unavailable?: boolean;
  validate?: LifecycleFunction | LifecycleFunction[];
  [key: string]: unknown;
}

// Mock implementation of lambdaHandler that follows the original implementation pattern
export const lambdaHandler = createMockFunction(
  (
    handlerOrOptions: HandlerFunction | LambdaOptions,
    optionsOrHandler?: LambdaOptions | HandlerFunction,
  ) => {
    // If handlerOrOptions is an object and optionsOrHandler is a function, swap them
    let handler: HandlerFunction;
    let options: LambdaOptions;

    if (
      typeof handlerOrOptions === "object" &&
      typeof optionsOrHandler === "function"
    ) {
      handler = optionsOrHandler;
      options = handlerOrOptions as LambdaOptions;
    } else {
      handler = handlerOrOptions as HandlerFunction;
      options = (optionsOrHandler || {}) as LambdaOptions;
    }

    // Basic validation
    if (typeof handler !== "function") {
      throw new BadRequestError("handler must be a function");
    }

    // Return a Lambda wrapper function that delegates to jaypieHandler
    return async (
      event: Record<string, unknown> = {},
      context: Record<string, unknown> = {},
      ...args: unknown[]
    ): Promise<unknown> => {
      return jaypieHandler(handler, options)(event, context, ...args);
    };
  },
);

// No additional helper functions needed - the original lambdaHandler implementation is sufficient
