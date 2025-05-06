import { createMockFunction } from "./utils";
import { vi } from "vitest";

// Mock implementation of lambdaHandler that follows the original implementation pattern
export const lambdaHandler = createMockFunction(
  (handlerOrOptions, optionsOrHandler) => {
    // If handlerOrOptions is an object and optionsOrHandler is a function, swap them
    let handler, options;
    if (
      typeof handlerOrOptions === "object" &&
      typeof optionsOrHandler === "function"
    ) {
      handler = optionsOrHandler;
      options = handlerOrOptions;
    } else {
      handler = handlerOrOptions;
      options = optionsOrHandler || {};
    }

    // Basic validation
    if (typeof handler !== "function") {
      throw new Error("Configuration error: handler must be a function");
    }

    // Return a Lambda wrapper function
    return async (event = {}, context = {}, ...args) => {
      // Extract options
      const { name = handler.name || "unknown", throw: shouldThrow = false } =
        options;

      // Create a mock logger
      const log = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: {
          var: vi.fn(),
        },
        tag: vi.fn(),
        untag: vi.fn(),
        lib: vi.fn(() => log),
        var: vi.fn(),
        fatal: vi.fn(),
      };

      // Add tags if awsRequestId is present
      if (context.awsRequestId) {
        log.tag({ invoke: context.awsRequestId });
        log.tag({ shortInvoke: context.awsRequestId.slice(0, 8) });
      }
      log.tag({ handler: name });

      // Log trace info
      log.trace("[jaypie] Lambda init");
      log.info.var({ event });

      // Execute the handler
      try {
        const response = await handler(event, context, ...args);
        log.info.var({ response });
        log.untag("handler");
        return response;
      } catch (error) {
        // Handle errors
        if (error.isProjectError) {
          log.debug("Caught jaypie error");
          log.var({ jaypieError: error });
          const response = error.json ? error.json() : { error: error.message };
          if (shouldThrow) {
            log.debug(
              `Throwing error instead of returning response (throw=${shouldThrow})`,
            );
            throw error;
          }
          return response;
        } else {
          log.fatal("Caught unhandled error");
          log.var({ unhandledError: error.message });
          if (shouldThrow) {
            throw error;
          }
          return { error: "UnhandledError" };
        }
      }
    };
  },
);

// No additional helper functions needed - the original lambdaHandler implementation is sufficient
