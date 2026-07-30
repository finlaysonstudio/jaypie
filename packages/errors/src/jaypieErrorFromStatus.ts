import { HTTP, JaypieError } from "./types";
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  GoneError,
  InternalError,
  MethodNotAllowedError,
  NotFoundError,
  TeapotError,
  TooManyRequestsError,
  UnauthorizedError,
  UnavailableError,
} from "./errors";

// One past the last client-error status
const CLIENT_MAX = 500;

export function jaypieErrorFromStatus(
  statusCode: number,
  message?: string,
): JaypieError {
  switch (statusCode) {
    case HTTP.CODE.BAD_REQUEST:
      return new BadRequestError(message);
    case HTTP.CODE.UNAUTHORIZED:
      return new UnauthorizedError(message);
    case HTTP.CODE.FORBIDDEN:
      return new ForbiddenError(message);
    case HTTP.CODE.NOT_FOUND:
      return new NotFoundError(message);
    case HTTP.CODE.METHOD_NOT_ALLOWED:
      return new MethodNotAllowedError(message);
    case HTTP.CODE.CONFLICT:
      return new ConflictError(message);
    case HTTP.CODE.GONE:
      return new GoneError(message);
    case HTTP.CODE.TEAPOT:
      return new TeapotError(message);
    case HTTP.CODE.TOO_MANY_REQUESTS:
      return new TooManyRequestsError(message);
    case HTTP.CODE.BAD_GATEWAY:
      return new BadGatewayError(message);
    case HTTP.CODE.UNAVAILABLE:
      return new UnavailableError(message);
    case HTTP.CODE.GATEWAY_TIMEOUT:
      return new GatewayTimeoutError(message);
    case HTTP.CODE.INTERNAL_ERROR:
      return new InternalError(message);
    default:
      // An unmapped 4xx is still a caller error: falling to InternalError would
      // describe it as an application fault
      if (statusCode >= HTTP.CODE.BAD_REQUEST && statusCode < CLIENT_MAX) {
        return new BadRequestError(message);
      }
      return new InternalError(message);
  }
}
