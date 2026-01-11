// Re-export everything from @jaypie/errors
export * from "@jaypie/errors";
export { jaypieErrorFromStatus as errorFromStatusCode } from "@jaypie/errors";

// Backwards compatibility aliases
// These types are not in @jaypie/errors but were previously exported from core
// TODO: Consider adding these to @jaypie/errors
export { InternalError as ProjectError } from "@jaypie/errors";
export { InternalError as MultiError } from "@jaypie/errors";
export { InternalError as ProjectMultiError } from "@jaypie/errors";

// ERROR constant - mirror from @jaypie/errors types
export const ERROR = {
  MESSAGE: {
    BAD_GATEWAY: "An unexpected error occurred on an upstream resource",
    BAD_REQUEST: "The request was not properly formatted",
    CONFIGURATION_ERROR:
      "The application responding to the request encountered a configuration error",
    CORS_ERROR: "The requesting origin is not authorized to this resource",
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
    TOO_MANY_REQUESTS: "The requesting origin exceeded the request limit",
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
    CORS_ERROR: "Unauthorized Origin",
    FORBIDDEN: "Forbidden",
    GATEWAY_TIMEOUT: "Gateway Timeout",
    GONE: "Gone",
    INTERNAL_ERROR: "Internal Application Error",
    METHOD_NOT_ALLOWED: "Method Not Allowed",
    NOT_FOUND: "Not Found",
    NOT_IMPLEMENTED: "Not Implemented",
    REJECTED: "Request Rejected",
    TEAPOT: "Teapot",
    TOO_MANY_REQUESTS: "Too Many Requests",
    UNAUTHORIZED: "Service Unauthorized",
    UNAVAILABLE: "Service Unavailable",
  },
  TYPE: {
    BAD_GATEWAY: "BAD_GATEWAY",
    BAD_REQUEST: "BAD_REQUEST",
    CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
    CORS_ERROR: "CORS_ERROR",
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
    TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
    UNAUTHORIZED: "UNAUTHORIZED",
    UNAVAILABLE: "UNAVAILABLE",
    UNHANDLED: "UNHANDLED",
    UNKNOWN_TYPE: "UNKNOWN_TYPE",
    UNREACHABLE_CODE: "UNREACHABLE_CODE",
  },
} as const;
