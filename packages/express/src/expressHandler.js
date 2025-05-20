import {
  force,
  HTTP,
  JAYPIE,
  jaypieHandler,
  log as publicLogger,
  UnhandledError,
  validate as validateIs,
} from "@jaypie/core";

import getCurrentInvokeUuid from "./getCurrentInvokeUuid.adapter.js";
import decorateResponse from "./decorateResponse.helper.js";
import summarizeRequest from "./summarizeRequest.helper.js";
import summarizeResponse from "./summarizeResponse.helper.js";

//
//
// Main
//

const expressHandler = (handler, options = {}) => {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof options === "function") {
    const temp = handler;
    handler = options;
    options = temp;
  }

  //
  //
  // Validate
  //
  let {
    locals,
    name,
    setup = [],
    teardown = [],
    unavailable,
    validate,
  } = options;
  validateIs.function(handler);
  validateIs.optional.object(locals);
  setup = force.array(setup); // allows a single item
  teardown = force.array(teardown); // allows a single item

  //
  //
  // Setup
  //

  let jaypieFunction;

  return async (req, res, ...params) => {
    // * This is the first line of code that runs when a request is received

    // Re-init the logger
    publicLogger.init();
    // Very low-level, internal sub-trace details
    const libLogger = publicLogger.lib({
      lib: JAYPIE.LIB.EXPRESS,
    });
    // Top-level, important details that run at the same level as the main logger
    const log = publicLogger.lib({
      level: publicLogger.level,
      lib: JAYPIE.LIB.EXPRESS,
    });

    // Update the public logger with the request ID
    const invokeUuid = getCurrentInvokeUuid();
    if (invokeUuid) {
      publicLogger.tag({ invoke: invokeUuid });
      publicLogger.tag({ shortInvoke: invokeUuid.slice(0, 8) });
      // TODO: in theory this is redundant
      libLogger.tag({ invoke: invokeUuid });
      libLogger.tag({ shortInvoke: invokeUuid.slice(0, 8) });
      log.tag({ invoke: invokeUuid });
      log.tag({ shortInvoke: invokeUuid.slice(0, 8) });
    }

    if (!name) {
      // If handler has a name, use it
      if (handler.name) {
        name = handler.name;
      } else {
        name = JAYPIE.UNKNOWN;
      }
    }
    publicLogger.tag({ handler: name });
    // TODO: in theory this is redundant
    libLogger.tag({ handler: name });
    log.tag({ handler: name });

    libLogger.trace("[jaypie] Express init");

    // Set req.locals if it doesn't exist
    if (!req.locals) req.locals = {};
    if (!req.locals._jaypie) req.locals._jaypie = {};

    // Set res.locals if it doesn't exist
    if (!res.locals) res.locals = {};
    if (!res.locals._jaypie) res.locals._jaypie = {};

    const originalRes = {
      attemptedCall: undefined,
      attemptedParams: undefined,
      end: res.end,
      json: res.json,
      send: res.send,
      status: res.status,
      statusSent: false,
    };

    res.end = (...params) => {
      originalRes.attemptedCall = originalRes.end;
      originalRes.attemptedParams = params;
      log.warn(
        "[jaypie] Illegal call to res.end(); prefer Jaypie response conventions",
      );
    };

    res.json = (...params) => {
      originalRes.attemptedCall = originalRes.json;
      originalRes.attemptedParams = params;
      log.warn(
        "[jaypie] Illegal call to res.json(); prefer Jaypie response conventions",
      );
    };

    res.send = (...params) => {
      originalRes.attemptedCall = originalRes.send;
      originalRes.attemptedParams = params;
      log.warn(
        "[jaypie] Illegal call to res.send(); prefer Jaypie response conventions",
      );
    };

    res.status = (...params) => {
      originalRes.statusSent = params;
      return originalRes.status(...params);
    };

    //
    //
    // Preprocess
    //

    if (locals) {
      // Locals
      const keys = Object.keys(locals);
      if (keys.length > 0) {
        const localsSetup = async (localsReq, localsRes) => {
          for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            libLogger.trace(`[jaypie] Locals: ${key}`);
            if (typeof locals[key] === "function") {
              localsReq.locals[key] = await locals[key](localsReq, localsRes);
            } else {
              localsReq.locals[key] = locals[key];
            }
          }
        };
        setup.push(localsSetup);
      }
    }

    let response;
    let status = HTTP.CODE.OK;

    try {
      log.info.var({ req: summarizeRequest(req) });

      // Initialize after logging is set up
      jaypieFunction = jaypieHandler(handler, {
        name,
        setup,
        teardown,
        unavailable,
        validate,
      });

      libLogger.trace("[jaypie] Express execution");

      //
      //
      // Process
      //

      response = await jaypieFunction(req, res, ...params);

      //
      //
      // Error Handling
      //
    } catch (error) {
      // In theory jaypieFunction has handled all errors
      if (error.status) {
        status = error.status;
      }
      if (typeof error.json === "function") {
        response = error.json();
      } else {
        // This should never happen
        const unhandledError = new UnhandledError();
        response = unhandledError.json();
        status = unhandledError.status;
      }
    }

    //
    //
    // Postprocess
    //

    // Restore original res functions
    res.end = originalRes.end;
    res.json = originalRes.json;
    res.send = originalRes.send;
    res.status = originalRes.status;

    // Decorate response
    decorateResponse(res, { handler: name });

    // Allow the sent status to override the status in the response
    if (originalRes.statusSent) {
      status = originalRes.statusSent;
    }

    // Send response
    try {
      if (!originalRes.attemptedCall) {
        // Body
        if (response) {
          if (typeof response === "object") {
            if (typeof response.json === "function") {
              res.json(response.json());
            } else {
              res.status(status).json(response);
            }
          } else if (typeof response === "string") {
            try {
              res.status(status).json(JSON.parse(response));
              // eslint-disable-next-line no-unused-vars
            } catch (error) {
              res.status(status).send(response);
            }
          } else if (response === true) {
            res.status(HTTP.CODE.CREATED).send();
          } else {
            res.status(status).send(response);
          }
        } else {
          // No response
          res.status(HTTP.CODE.NO_CONTENT).send();
        }
      } else {
        // Resolve illegal call to res.end(), res.json(), or res.send()
        log.debug("[jaypie] Resolving illegal call to res");
        log.var({
          attemptedCall: {
            name: originalRes.attemptedCall.name,
            params: originalRes.attemptedParams,
          },
        });
        // Call the original function with the original parameters and the original `this` (res)
        originalRes.attemptedCall.call(res, ...originalRes.attemptedParams);
      }
    } catch (error) {
      log.fatal("Express encountered an error while sending the response");
      log.var({ responseError: error });
    }

    // Log response
    const extras = {};
    if (response) extras.body = response;
    log.info.var({
      res: summarizeResponse(res, extras),
    });

    // Clean up the public logger
    publicLogger.untag("handler");

    //
    //
    // Return
    //

    return response;
  };
};

//
//
// Export
//

export default expressHandler;
