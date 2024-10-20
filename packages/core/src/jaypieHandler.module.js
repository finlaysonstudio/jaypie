import { JAYPIE, log as publicLogger } from "./core.js";

import {
  BadRequestError,
  UnavailableError,
  UnhandledError,
} from "./lib/errors.lib.js";

import { envBoolean } from "./lib/functions.lib.js";

//
//
// Constants
//

//
//
// Helper Functions
//

//
//
// Main
//

const jaypieHandler = (
  handler,
  {
    name = undefined,
    setup = [],
    teardown = [],
    unavailable = envBoolean("PROJECT_UNAVAILABLE", { defaultValue: false }),
    validate = [],
  } = {},
) => {
  //
  //
  // Validate
  //

  if (!name) {
    name = "unknown";
    // If handler has a name, use it
    if (handler.name) {
      name = handler.name;
    }
  }

  //
  //
  // Setup
  //

  // The public logger
  publicLogger.tag({ handler: name });

  // Internal convention
  const log = publicLogger.with({
    lib: JAYPIE.LIB.CORE,
  });
  const libLogger = log.lib({
    lib: JAYPIE.LIB.CORE,
  });

  libLogger.trace("[jaypie] Handler init");
  return async (...args) => {
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
      if (error.isProjectError) {
        log.debug("[handler] Caught Jaypie error");
        throw error;
      } else {
        // otherwise, respond as unhandled
        log.fatal("[handler] Caught unhandled error");
        log.error(`[${error.name}] ${error.message}`);
        log.var({
          unhandedError: {
            // class: error.constructor.name,
            name: error.name,
            message: error.message,
            stack: error.stack,
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
      if (error.isProjectError) {
        log.debug("[handler] Caught Jaypie error");
        throw error;
      } else {
        // otherwise, respond as unhandled
        log.fatal("[handler] Caught unhandled error");
        log.error(`[${error.name}] ${error.message}`);
        log.var({
          unhandedError: {
            // class: error.constructor.name,
            name: error.name,
            message: error.message,
            stack: error.stack,
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
              if (error.isProjectError) {
                log.debug("[handler] Teardown error");
              } else {
                log.error("[handler] Unhandled teardown error");
                log.var({ unhandedError: error.message });
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
