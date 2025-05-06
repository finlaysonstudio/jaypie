/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMockFunction } from "./utils";
import * as core from "./core";

// Constants for mock values
const TAG = "EXPRESS";

// Add Express route functions
export const badRequestRoute = createMockFunction<
  (req: any, res: any, next: any) => void
>((req, res, next) => {
  try {
    // Try original implementation first, but fall back to mock
    res.status(400).json({
      error: {
        name: "BadRequestError",
        message: "Bad request",
      },
    });
  } catch (error) {
    res.status(400).json({ error: `_MOCK_BAD_REQUEST_ROUTE_[${TAG}]` });
  }
});

export const echoRoute = createMockFunction<
  (req: any, res: any, next: any) => void
>((req, res, next) => {
  try {
    // Try original implementation first, but fall back to mock
    res.status(200).json({
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    });
  } catch (error) {
    res.status(200).json({ echo: `_MOCK_ECHO_ROUTE_[${TAG}]` });
  }
});

export const forbiddenRoute = createMockFunction<
  (req: any, res: any, next: any) => void
>((req, res, next) => {
  try {
    // Try original implementation first, but fall back to mock
    res.status(403).json({
      error: {
        name: "ForbiddenError",
        message: "Forbidden",
      },
    });
  } catch (error) {
    res.status(403).json({ error: `_MOCK_FORBIDDEN_ROUTE_[${TAG}]` });
  }
});

export const goneRoute = createMockFunction<
  (req: any, res: any, next: any) => void
>((req, res, next) => {
  try {
    // Try original implementation first, but fall back to mock
    res.status(410).json({
      error: {
        name: "GoneError",
        message: "Gone",
      },
    });
  } catch (error) {
    res.status(410).json({ error: `_MOCK_GONE_ROUTE_[${TAG}]` });
  }
});

export const methodNotAllowedRoute = createMockFunction<
  (req: any, res: any, next: any) => void
>((req, res, next) => {
  try {
    // Try original implementation first, but fall back to mock
    res.status(405).json({
      error: {
        name: "MethodNotAllowedError",
        message: "Method not allowed",
      },
    });
  } catch (error) {
    res.status(405).json({ error: `_MOCK_METHOD_NOT_ALLOWED_ROUTE_[${TAG}]` });
  }
});

export const noContentRoute = createMockFunction<
  (req: any, res: any, next: any) => void
>((req, res, next) => {
  try {
    // Try original implementation first, but fall back to mock
    res.status(204).end();
  } catch (error) {
    res.status(204).end();
  }
});

export const notFoundRoute = createMockFunction<
  (req: any, res: any, next: any) => void
>((req, res, next) => {
  try {
    // Try original implementation first, but fall back to mock
    res.status(404).json({
      error: {
        name: "NotFoundError",
        message: "Not found",
      },
    });
  } catch (error) {
    res.status(404).json({ error: `_MOCK_NOT_FOUND_ROUTE_[${TAG}]` });
  }
});

export const notImplementedRoute = createMockFunction<
  (req: any, res: any, next: any) => void
>((req, res, next) => {
  try {
    // Try original implementation first, but fall back to mock
    next(new core.NotImplementedError("Not implemented"));
  } catch (error) {
    next(new Error(`_MOCK_NOT_IMPLEMENTED_ROUTE_[${TAG}]`));
  }
});

export const expressHttpCodeHandler = createMockFunction<
  (statusCode: number, options?: any) => (req: any, res: any, next: any) => void
>((statusCode, options = {}) => {
  try {
    // Try to mimic original implementation
    return (req, res, next) => {
      // For success codes, return empty response
      if (statusCode >= 200 && statusCode < 300) {
        if (statusCode === 204) {
          return res.status(statusCode).end();
        }
        return res.status(statusCode).json({});
      }

      // For error codes, create an error and format it
      const error = core.errorFromStatusCode(statusCode, options.message);
      return res.status(statusCode).json({ error: core.formatError(error) });
    };
    // eslint-disable-next-line no-unreachable
  } catch (error) {
    return (req, res, next) => {
      res
        .status(statusCode)
        .json({ mock: `_MOCK_HTTP_CODE_HANDLER_[${TAG}][${statusCode}]` });
    };
  }
});

export const expressHandler = createMockFunction<
  (
    handler: Function,
    options?: any,
  ) => (req: any, res: any, next: any) => Promise<any>
>((handler, options = {}) => {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res, next);

      // If result is undefined or null and headers not sent, return 204
      if ((result === undefined || result === null) && !res.headersSent) {
        return res.status(204).end();
      }

      // If headers already sent, do nothing
      if (res.headersSent) {
        return;
      }

      // Otherwise return the result as JSON
      return res.json(result);
    } catch (error) {
      // Pass errors to the next middleware
      next(error);
    }
  };
});
