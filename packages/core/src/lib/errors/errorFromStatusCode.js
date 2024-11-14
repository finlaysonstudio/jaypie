import {
  BadGatewayError,
  BadRequestError,
  ForbiddenError,
  GatewayTimeoutError,
  GoneError,
  InternalError,
  MethodNotAllowedError,
  NotFoundError,
  TeapotError,
  UnauthorizedError,
  UnavailableError,
} from "./errors.js";

const errorMap = {
  400: BadRequestError,
  401: UnauthorizedError,
  403: ForbiddenError,
  404: NotFoundError,
  405: MethodNotAllowedError,
  410: GoneError,
  418: TeapotError,
  500: InternalError,
  502: BadGatewayError,
  503: UnavailableError,
  504: GatewayTimeoutError,
};

/**
 * Creates an appropriate error instance based on the HTTP status code
 * @param {number} statusCode - HTTP status code
 * @param {string} [message] - Optional custom error message
 * @returns {ProjectError} Instance of the corresponding error class
 */
export function errorFromStatusCode(statusCode, message) {
  const ErrorClass = errorMap[statusCode] || InternalError;
  return new ErrorClass(message);
}

export default errorFromStatusCode;
