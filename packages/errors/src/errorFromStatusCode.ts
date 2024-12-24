import { HTTP, JaypieError } from "./types";
import {
  BadGatewayError,
  BadRequestError,
  ForbiddenError,
  GatewayTimeoutError,
  GoneError,
  InternalError,
  NotFoundError,
  TeapotError,
  UnauthorizedError,
  UnavailableError,
} from "./errors";

export function errorFromStatusCode(statusCode: number, message?: string): JaypieError {
  switch (statusCode) {
    case HTTP.CODE.BAD_REQUEST:
      return new BadRequestError(message);
    case HTTP.CODE.UNAUTHORIZED:
      return new UnauthorizedError(message);
    case HTTP.CODE.FORBIDDEN:
      return new ForbiddenError(message);
    case HTTP.CODE.NOT_FOUND:
      return new NotFoundError(message);
    case HTTP.CODE.GONE:
      return new GoneError(message);
    case HTTP.CODE.TEAPOT:
      return new TeapotError(message);
    case HTTP.CODE.BAD_GATEWAY:
      return new BadGatewayError(message);
    case HTTP.CODE.UNAVAILABLE:
      return new UnavailableError(message);
    case HTTP.CODE.GATEWAY_TIMEOUT:
      return new GatewayTimeoutError(message);
    case HTTP.CODE.INTERNAL_ERROR:
    default:
      return new InternalError(message);
  }
}
