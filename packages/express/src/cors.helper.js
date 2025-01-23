import { CorsError } from "@jaypie/errors";
import { envBoolean, force } from "@jaypie/core";
import expressCors from "cors";

//
//
// Constants
//

const HTTP_PROTOCOL = "http://";
const HTTPS_PROTOCOL = "https://";
const SANDBOX_ENV = "sandbox";

//
//
// Helper Functions
//

const ensureProtocol = (url) => {
  if (!url) return url;
  if (url.startsWith(HTTP_PROTOCOL) || url.startsWith(HTTPS_PROTOCOL))
    return url;
  return HTTPS_PROTOCOL + url;
};

export const dynamicOriginCallbackHandler = (origin) => {
  return (requestOrigin, callback) => {
    // Handle wildcard origin
    if (origin === "*") {
      callback(null, true);
      return;
    }

    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!requestOrigin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = [];
    if (process.env.BASE_URL) {
      allowedOrigins.push(ensureProtocol(process.env.BASE_URL));
    }
    if (process.env.PROJECT_BASE_URL) {
      allowedOrigins.push(ensureProtocol(process.env.PROJECT_BASE_URL));
    }
    if (origin) {
      const additionalOrigins = force.array(origin);
      allowedOrigins.push(...additionalOrigins);
    }

    // Add localhost origins in sandbox
    if (
      process.env.PROJECT_ENV === SANDBOX_ENV ||
      envBoolean("PROJECT_SANDBOX_MODE")
    ) {
      allowedOrigins.push("http://localhost");
      allowedOrigins.push(/^http:\/\/localhost:\d+$/);
    }

    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed instanceof RegExp) {
        return allowed.test(requestOrigin);
      }
      return requestOrigin.includes(allowed);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new CorsError());
    }
  };
};

//
//
// Main
//

const corsHelper = (config = {}) => {
  const { origin, overrides = {} } = config;

  const options = {
    origin: dynamicOriginCallbackHandler(origin),
    // * The default behavior is to allow any headers and methods so they are not included here
    ...overrides,
  };

  return expressCors(options);
};

//
//
// Export
//

export default (config) => {
  const cors = corsHelper(config);
  return (req, res, next) => {
    cors(req, res, (error) => {
      if (error) {
        res.status(error.status);
        res.setHeader("Content-Type", "application/json");
        return res.json(error.body());
      }
      next();
    });
  };
};
