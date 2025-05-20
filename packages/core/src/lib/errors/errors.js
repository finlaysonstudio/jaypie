import HTTP from "../http.lib.js";
import formatError from "./formatError.js";

//
//
// Helpers
//

const proxyClassAsFunction = {
  apply: (target, thisArgument, argumentsList) => new target(...argumentsList),
};

//
//
// Constants
//

const NAME = "ProjectError";

export const ERROR = {
  MESSAGE: {
    BAD_GATEWAY: "An unexpected error occurred on an upstream resource",
    BAD_REQUEST: "The request was not properly formatted",
    CONFIGURATION_ERROR:
      "The application responding to the request encountered a configuration error",
    FORBIDDEN: "Access to this resource is not authorized",
    GATEWAY_TIMEOUT:
      "The connection timed out waiting for an upstream resource",
    GONE: "The requested resource is no longer available",
    ILLOGICAL:
      "The application encountered an illogical condition while processing the request",
    INTERNAL_ERROR:
      "An unexpected error occurred and the request was unable to complete",
    METHOD_NOT_ALLOWED: "The requested method is not allowed",
    NOT_FOUND: "The requested resource was not found",
    NOT_IMPLEMENTED:
      "The request was understood but the resource is not implemented",
    REJECTED: "The request was rejected prior to processing",
    TEAPOT: "This resource is a teapot incapable of processing the request",
    UNAUTHORIZED:
      "The request did not include valid authentication credentials",
    UNAVAILABLE: "The requested resource is temporarily unavailable",
    UNHANDLED:
      "An unhandled error occurred and the request was unable to complete",
    UNREACHABLE_CODE:
      "The application encountered an unreachable condition while processing the request",
  },
  TITLE: {
    BAD_GATEWAY: "Bad Gateway",
    BAD_REQUEST: "Bad Request",
    CONFIGURATION_ERROR: "Internal Configuration Error",
    FORBIDDEN: "Forbidden",
    GATEWAY_TIMEOUT: "Gateway Timeout",
    GONE: "Gone",
    INTERNAL_ERROR: "Internal Application Error",
    METHOD_NOT_ALLOWED: "Method Not Allowed",
    NOT_FOUND: "Not Found",
    NOT_IMPLEMENTED: "Not Implemented",
    REJECTED: "Request Rejected",
    TEAPOT: "Teapot",
    UNAUTHORIZED: "Service Unauthorized",
    UNAVAILABLE: "Service Unavailable",
  },
  TYPE: {
    BAD_GATEWAY: "BAD_GATEWAY",
    BAD_REQUEST: "BAD_REQUEST",
    CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
    FORBIDDEN: "FORBIDDEN",
    GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",
    GONE: "GONE",
    ILLOGICAL: "ILLOGICAL",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    MULTI_ERROR: "MULTI_ERROR",
    NOT_FOUND: "NOT_FOUND",
    NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
    REJECTED: "REJECTED",
    TEAPOT: "TEAPOT",
    UNAUTHORIZED: "UNAUTHORIZED",
    UNAVAILABLE: "UNAVAILABLE",
    UNHANDLED: "UNHANDLED",
    UNKNOWN_TYPE: "UNKNOWN_TYPE",
    UNREACHABLE_CODE: "UNREACHABLE_CODE",
  },
};

//
//
// Public Classes
//

export class ProjectError extends Error {
  constructor(
    message = ERROR.MESSAGE.INTERNAL_ERROR,
    {
      status = HTTP.CODE.INTERNAL_ERROR,
      title = ERROR.TITLE.INTERNAL_ERROR,
    } = {},
    { _type = ERROR.TYPE.UNKNOWN_TYPE } = {},
  ) {
    super(message);
    this.title = title;
    this.detail = message;
    this.status = status;
    this.name = NAME;
    this.isProjectError = true;
    this._type = _type;
    this.json = () => {
      const { data, status } = formatError(this);
      this.status = status;
      return data;
    };
  }
}

export class ProjectMultiError extends Error {
  constructor(errors = []) {
    super();
    this.errors = errors;
    this.name = NAME;
    this.isProjectError = true;
    const { status } = formatError(this);
    this.status = status;
    this._type = ERROR.TYPE.MULTI_ERROR;
    this.json = () => {
      const { data } = formatError(this);
      return data;
    };
  }
}

//
//
// Error Functions (to throw)
//

// Standard HTTP

export const BadGatewayError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.BAD_GATEWAY) {
      return new ProjectError(message, {
        status: HTTP.CODE.BAD_GATEWAY,
        title: ERROR.TITLE.BAD_GATEWAY,
      });
    }
  },
  proxyClassAsFunction,
);

export const BadRequestError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.BAD_REQUEST) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.BAD_REQUEST,
          title: ERROR.TITLE.BAD_REQUEST,
        },
        { _type: ERROR.TYPE.BAD_REQUEST },
      );
    }
  },
  proxyClassAsFunction,
);

export const ForbiddenError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.FORBIDDEN) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.FORBIDDEN,
          title: ERROR.TITLE.FORBIDDEN,
        },
        { _type: ERROR.TYPE.FORBIDDEN },
      );
    }
  },
  proxyClassAsFunction,
);

export const GatewayTimeoutError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.GATEWAY_TIMEOUT) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.GATEWAY_TIMEOUT,
          title: ERROR.TITLE.GATEWAY_TIMEOUT,
        },
        { _type: ERROR.TYPE.GATEWAY_TIMEOUT },
      );
    }
  },
  proxyClassAsFunction,
);

export const GoneError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.GONE) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.GONE,
          title: ERROR.TITLE.GONE,
        },
        { _type: ERROR.TYPE.GONE },
      );
    }
  },
  proxyClassAsFunction,
);

export const InternalError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.INTERNAL_ERROR) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.INTERNAL_ERROR,
          title: ERROR.TITLE.INTERNAL_ERROR,
        },
        { _type: ERROR.TYPE.INTERNAL_ERROR },
      );
    }
  },
  proxyClassAsFunction,
);

export const MethodNotAllowedError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.METHOD_NOT_ALLOWED) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.METHOD_NOT_ALLOWED,
          title: ERROR.TITLE.METHOD_NOT_ALLOWED,
        },
        { _type: ERROR.TYPE.METHOD_NOT_ALLOWED },
      );
    }
  },
  proxyClassAsFunction,
);

export const NotFoundError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.NOT_FOUND) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.NOT_FOUND,
          title: ERROR.TITLE.NOT_FOUND,
        },
        { _type: ERROR.TYPE.NOT_FOUND },
      );
    }
  },
  proxyClassAsFunction,
);

export const TeapotError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.TEAPOT) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.TEAPOT,
          title: ERROR.TITLE.TEAPOT,
        },
        { _type: ERROR.TYPE.TEAPOT },
      );
    }
  },
  proxyClassAsFunction,
);

export const UnauthorizedError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.UNAUTHORIZED) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.UNAUTHORIZED,
          title: ERROR.TITLE.UNAUTHORIZED,
        },
        { _type: ERROR.TYPE.UNAUTHORIZED },
      );
    }
  },
  proxyClassAsFunction,
);

export const UnavailableError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.UNAVAILABLE) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.UNAVAILABLE,
          title: ERROR.TITLE.UNAVAILABLE,
        },
        { _type: ERROR.TYPE.UNAVAILABLE },
      );
    }
  },
  proxyClassAsFunction,
);

// Special Errors

export const ConfigurationError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.CONFIGURATION_ERROR) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.INTERNAL_ERROR,
          title: ERROR.TITLE.CONFIGURATION_ERROR,
        },
        { _type: ERROR.TYPE.CONFIGURATION_ERROR },
      );
    }
  },
  proxyClassAsFunction,
);

export const IllogicalError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.ILLOGICAL) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.INTERNAL_ERROR,
          title: ERROR.TITLE.INTERNAL_ERROR,
        },
        { _type: ERROR.TYPE.ILLOGICAL },
      );
    }
  },
  proxyClassAsFunction,
);

export const MultiError = ProjectMultiError;

export const RejectedError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.REJECTED) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.FORBIDDEN,
          title: ERROR.TITLE.REJECTED,
        },
        { _type: ERROR.TYPE.REJECTED },
      );
    }
  },
  proxyClassAsFunction,
);

export const NotImplementedError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.NOT_IMPLEMENTED) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.BAD_REQUEST,
          title: ERROR.TITLE.NOT_IMPLEMENTED,
        },
        { _type: ERROR.TYPE.NOT_IMPLEMENTED },
      );
    }
  },
  proxyClassAsFunction,
);

export const UnhandledError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.UNHANDLED) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.INTERNAL_ERROR,
          title: ERROR.TITLE.INTERNAL_ERROR,
        },
        { _type: ERROR.TYPE.UNHANDLED },
      );
    }
  },
  proxyClassAsFunction,
);

export const UnreachableCodeError = new Proxy(
  class {
    constructor(message = ERROR.MESSAGE.UNREACHABLE_CODE) {
      return new ProjectError(
        message,
        {
          status: HTTP.CODE.INTERNAL_ERROR,
          title: ERROR.TITLE.INTERNAL_ERROR,
        },
        {
          _type: ERROR.TYPE.UNREACHABLE_CODE,
        },
      );
    }
  },
  proxyClassAsFunction,
);

//
//
// Export
//

export default {
  BadGatewayError,
  BadRequestError,
  ConfigurationError,
  ERROR,
  ForbiddenError,
  formatError,
  GatewayTimeoutError,
  GoneError,
  IllogicalError,
  InternalError,
  MethodNotAllowedError,
  MultiError,
  NAME,
  NotFoundError,
  NotImplementedError,
  ProjectError,
  ProjectMultiError,
  RejectedError,
  TeapotError,
  UnauthorizedError,
  UnavailableError,
  UnhandledError,
  UnreachableCodeError,
};
