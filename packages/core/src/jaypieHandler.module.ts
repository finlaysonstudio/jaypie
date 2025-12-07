import { JAYPIE, log as publicLogger } from "./core.js";

import {
  BadRequestError,
  UnavailableError,
  UnhandledError,
} from "@jaypie/errors";

import { envBoolean } from "./lib/functions.lib.js";
import invokeChaos from "./lib/functions/invokeChaos.function.js";

//
//
// Types
//

type AsyncHandler = (...args: unknown[]) => Promise<unknown>;
type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;
type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;

interface JaypieHandlerOptions {
  chaos?: string;
  name?: string;
  setup?: LifecycleFunction[];
  teardown?: LifecycleFunction[];
  unavailable?: boolean;
  validate?: ValidatorFunction[];
}

interface JaypieError extends Error {
  isProjectError?: boolean;
}

//
//
// Main
//

const jaypieHandler = (
  handler: AsyncHandler,
  {
    chaos = process.env.PROJECT_CHAOS || "none",
    name = undefined,
    setup = [],
    teardown = [],
    unavailable = envBoolean("PROJECT_UNAVAILABLE", { defaultValue: false }) ??
      false,
    validate = [],
  }: JaypieHandlerOptions = {},
): AsyncHandler => {
  //
  //
  // Validate
  //

  let handlerName = name;
  if (!handlerName) {
    handlerName = "unknown";
    // If handler has a name, use it
    if (handler.name) {
      handlerName = handler.name;
    }
  }

  //
  //
  // Setup
  //

  // The public logger
  publicLogger.tag({ handler: handlerName });

  // Internal convention
  const log = publicLogger.with({
    lib: JAYPIE.LIB.CORE,
  });
  const libLogger = log.lib({
    lib: JAYPIE.LIB.CORE,
  });

  libLogger.trace("[jaypie] Handler init");
  return async (...args: unknown[]): Promise<unknown> => {
    libLogger.trace("[jaypie] Handler execution");
    log.trace("[handler] Project logging in trace mode");

    //
    //
    // Preprocess
    //

    // Lifecycle: Available
    if (unavailable) {
      log.warn(
        "[handler] Unavailable: either PROJECT_UNAVAILABLE=true or { unavailable: true } was passed to handler",
      );
      throw new UnavailableError();
    }

    // Lifecycle: Chaos
    await invokeChaos(chaos, { log });

    // Lifecycle: Validate
    try {
      if (Array.isArray(validate) && validate.length > 0) {
        log.trace(`[handler] Validate`);
        for (const validator of validate) {
          if (typeof validator === "function") {
            const result = await validator(...args);
            if (result === false) {
              log.warn("[handler] Validation failed");
              throw new BadRequestError();
            }
          } else {
            log.warn("[handler] Validate skipping non-function in array");
            log.var({ skippedValidate: validator });
          }
        }
      }
    } catch (error) {
      // Log and re-throw
      if ((error as JaypieError).isProjectError) {
        log.debug("[handler] Caught Jaypie error");
        throw error;
      } else {
        // otherwise, respond as unhandled
        const err = error as Error;
        log.fatal("[handler] Caught unhandled error");
        log.error(`[${err.name}] ${err.message}`);
        log.var({
          unhandedError: {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
        });
        throw new UnhandledError();
      }
    }

    // Once we begin (try) setup, we are committed to (finally) teardown
    try {
      // Lifecycle: Setup
      if (Array.isArray(setup) && setup.length > 0) {
        log.trace("[handler] Setup");
        for (const setupFunction of setup) {
          if (typeof setupFunction === "function") {
            await setupFunction(...args);
          } else {
            log.warn("[handler] Setup skipping non-function in array");
            log.var({ skippedSetup: setupFunction });
          }
        }
      }

      // Lifecycle: Handler
      log.trace("[handler] Handler call");
      const result = await handler(...args);
      log.trace("[handler] Handler return");
      return result;
    } catch (error) {
      // Log and re-throw
      if ((error as JaypieError).isProjectError) {
        log.debug("[handler] Caught Jaypie error");
        throw error;
      } else {
        // otherwise, respond as unhandled
        const err = error as Error;
        log.fatal("[handler] Caught unhandled error");
        log.error(`[${err.name}] ${err.message}`);
        log.var({
          unhandedError: {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
        });
        throw new UnhandledError();
      }
    } finally {
      // Teardown
      if (Array.isArray(teardown) && teardown.length > 0) {
        log.trace("[handler] Teardown");
        for (const teardownFunction of teardown) {
          if (typeof teardownFunction === "function") {
            try {
              await teardownFunction(...args);
            } catch (error) {
              if ((error as JaypieError).isProjectError) {
                log.debug("[handler] Teardown error");
              } else {
                log.error("[handler] Unhandled teardown error");
                log.var({ unhandedError: (error as Error).message });
              }
            }
          } else {
            log.warn("[handler] Teardown skipping non-function in array");
            log.var({ skippedTeardown: teardownFunction });
          }
        }
      }
    }
  };
};

//
//
// Export
//

export default jaypieHandler;
