import { JAYPIE, log as publicLogger } from "./core.js";

import {
  BadRequestError,
  jaypieErrorFromStatus,
  UnavailableError,
  UnhandledError,
} from "@jaypie/errors";

import { envBoolean } from "./lib/functions.lib.js";
import invokeChaos from "./lib/functions/invokeChaos.function.js";
import HTTP from "./lib/http.lib.js";

//
//
// Types
//

type AsyncHandler = (...args: unknown[]) => Promise<unknown>;
type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;
type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;

export interface ScrubOptions {
  client?: boolean;
  server?: boolean;
}

export type ScrubOption = boolean | ScrubOptions;

export interface JaypieHandlerOptions {
  chaos?: string;
  name?: string;
  scrub?: ScrubOption;
  setup?: LifecycleFunction[];
  teardown?: LifecycleFunction[];
  unavailable?: boolean;
  validate?: ValidatorFunction[];
}

interface JaypieError extends Error {
  detail?: string;
  isProjectError?: boolean;
  status?: number;
  title?: string;
}

//
//
// Helpers
//

// The leading digit of an HTTP status: 4 for client errors, 5 for server errors
function errorClass(status: number): number {
  return Math.floor(status / 100);
}

// 4xx describes what the caller can correct, so its detail is the response;
// 5xx describes application internals and belongs only in logs
const SCRUB_DEFAULT: Required<ScrubOptions> = {
  client: false,
  server: true,
};

function resolveScrub(scrub: ScrubOption): Required<ScrubOptions> {
  if (typeof scrub === "boolean") {
    return { client: scrub, server: scrub };
  }
  return {
    client: scrub.client ?? SCRUB_DEFAULT.client,
    server: scrub.server ?? SCRUB_DEFAULT.server,
  };
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
    scrub = SCRUB_DEFAULT,
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
    lib: JAYPIE.LIB.KIT,
  });
  const libLogger = log.lib({
    lib: JAYPIE.LIB.KIT,
  });

  const scrubErrors = resolveScrub(scrub);

  // Report a caught Jaypie error, then scrub it.
  //
  // Level follows status: 500-class is an infrastructure or application fault
  // and logs at error so monitors filtering on error status see the outage;
  // 4xx is a caller mistake and logs at warn.
  //
  // The error as thrown is always logged. Scrubbing replaces `detail` and
  // `title` with the generic strings for the status, so whatever the
  // application passed to the error constructor never reaches a response body.
  // 5xx is scrubbed by default and 4xx is not, since a client error is only
  // actionable when it says what to correct; `scrub` overrides either class.
  // `message` and `stack` are left intact for logs and for handlers configured
  // to rethrow.
  const reportJaypieError = (error: JaypieError, message: string): void => {
    const { detail, status, title } = error;

    if (typeof status === "number" && status >= HTTP.CODE.INTERNAL_ERROR) {
      log.error(message);
    } else if (typeof status === "number" && status >= HTTP.CODE.BAD_REQUEST) {
      log.warn(message);
    } else {
      log.debug(message);
    }
    log.var({ jaypieError: { detail, status, title } });

    if (typeof status !== "number") {
      return;
    }
    if (status >= HTTP.CODE.INTERNAL_ERROR) {
      if (!scrubErrors.server) {
        return;
      }
    } else if (status >= HTTP.CODE.BAD_REQUEST) {
      if (!scrubErrors.client) {
        return;
      }
    } else {
      return;
    }
    const generic = jaypieErrorFromStatus(status);
    // An unmapped status resolves to the generic for its class: a 4xx to
    // BadRequestError, anything else to InternalError. Scrub only when the
    // substitute belongs to the same class, so a status outside 4xx/5xx is not
    // described as an application fault
    if (errorClass(generic.status) !== errorClass(status)) {
      return;
    }
    error.detail = generic.detail;
    error.title = generic.title;
  };

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
        reportJaypieError(
          error as JaypieError,
          "[handler] Caught Jaypie error",
        );
        throw error;
      } else {
        // otherwise, respond as unhandled
        const err = error as Error;
        publicLogger.fatal("[handler] Caught unhandled error");
        publicLogger.error(`[${err.name}] ${err.message}`);
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
        reportJaypieError(
          error as JaypieError,
          "[handler] Caught Jaypie error",
        );
        throw error;
      } else {
        // otherwise, respond as unhandled
        const err = error as Error;
        publicLogger.fatal("[handler] Caught unhandled error");
        publicLogger.error(`[${err.name}] ${err.message}`);
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
                reportJaypieError(
                  error as JaypieError,
                  "[handler] Teardown error",
                );
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
