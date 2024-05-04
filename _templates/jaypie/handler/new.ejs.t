---
to: <%= path %>/<%= name %><%= dotSubtype %>.js
---
import { ForbiddenError, InternalError } from "@knowdev/errors";
import { log, projectHandler } from "@knowdev/express";

import {
  authValidSessionSetup,
  browserSessionValidator,
  requiredBrowserCookieLocal,
  requiredSessionCookieLocal,
} from "../../lib/trace/index.js";

import Model from "../../models/index.js";

//
//
// Main
//

export default projectHandler(
  async (req, res) => {
    //
    //
    // Validate
    //

    // Provided by requireSessionHandler
    const browserCookie = req.signedCookies[COOKIE.BROWSER];
    if (!browserCookie) {
      log.error("Missing browser cookie; exiting");
      throw new ForbiddenError();
    }

    //
    //
    // Setup
    //

    const browserUuid = req.locals.browser;
    const sessionUuid = req.locals.session;

    //
    //
    // Preprocess
    //

    //
    //
    // Process
    //

    try {
      // const Schema = Model.new.Schema();
      // const instance = await Schema.findOne({ uuid }).exec();
    } catch (error) {
      log.debug("Caught error during processing");
      log.error.var({ error });
      throw new InternalError("Caught error during processing");
    }

    //
    //
    // Postprocess
    //

    //
    //
    // Return
    //

    res.json({
      data: {
        // id,
        // type,
      },
    });
  },
  { 
    name: "<%= name %>",
    locals: {
      browser: requiredBrowserCookieLocal,
      session: requiredSessionCookieLocal,
    },
    setup: [Model.connect, authValidSessionSetup],
    teardown: [Model.disconnect],
    validate: [
      browserSessionValidator,
      // jsonApiValidator({ type, attributes: {} }),
    ],
  },
);
