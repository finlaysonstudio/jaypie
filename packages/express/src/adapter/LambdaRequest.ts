import type { IncomingHttpHeaders } from "node:http";
import { Readable } from "node:stream";

import type {
  ApiGatewayV1Event,
  FunctionUrlEvent,
  LambdaContext,
  LambdaEvent,
} from "./types.js";

//
//
// Types
//

interface LambdaRequestOptions {
  body?: Buffer | null;
  headers: Record<string, string>;
  lambdaContext: LambdaContext;
  lambdaEvent: LambdaEvent;
  method: string;
  protocol: string;
  query?: Record<string, string | string[]>;
  remoteAddress: string;
  url: string;
}

interface MockSocket {
  destroy: () => void;
  encrypted: boolean;
  remoteAddress: string;
}

//
//
// LambdaRequest Class
//

/**
 * Mock IncomingMessage that extends Readable stream.
 * Provides Express-compatible request interface from Lambda Function URL events.
 */
export class LambdaRequest extends Readable {
  // IncomingMessage required properties
  public readonly method: string;
  public readonly url: string;
  public readonly headers: IncomingHttpHeaders;
  public readonly httpVersion: string = "1.1";
  public readonly httpVersionMajor: number = 1;
  public readonly httpVersionMinor: number = 1;
  public complete: boolean = false;

  // Socket mock for Express compatibility
  public readonly socket: MockSocket;
  public readonly connection: MockSocket;

  // Express-expected properties
  public readonly originalUrl: string;
  public readonly path: string;
  public baseUrl: string = "";
  public body: unknown;
  public params: Record<string, string> = {};
  public query: Record<string, unknown> = {};

  // Jaypie-specific: store Lambda context for getCurrentInvokeUuid
  public readonly _lambdaContext: LambdaContext;
  public readonly _lambdaEvent: LambdaEvent;

  // Internal state
  private bodyBuffer: Buffer | null;
  private bodyPushed: boolean = false;

  constructor(options: LambdaRequestOptions) {
    super();

    this.method = options.method;
    this.url = options.url;
    this.originalUrl = options.url;
    this.path = options.url.split("?")[0];
    this.headers = this.normalizeHeaders(options.headers);
    this.bodyBuffer = options.body ?? null;

    // Use pre-parsed query if provided, otherwise parse from URL
    if (options.query) {
      this.query = options.query;
    } else {
      const queryIndex = options.url.indexOf("?");
      if (queryIndex !== -1) {
        const queryString = options.url.slice(queryIndex + 1);
        this.query = parseQueryString(queryString);
      }
    }

    // Store Lambda context
    this._lambdaContext = options.lambdaContext;
    this._lambdaEvent = options.lambdaEvent;

    // Create mock socket
    this.socket = {
      destroy: () => {},
      encrypted: options.protocol === "https",
      remoteAddress: options.remoteAddress,
    };
    this.connection = this.socket;

    // Schedule body push for next tick to ensure stream is ready
    // This is needed for body parsers that consume the stream
    if (this.bodyBuffer && this.bodyBuffer.length > 0) {
      process.nextTick(() => {
        if (!this.bodyPushed) {
          this.push(this.bodyBuffer);
          this.push(null);
          this.bodyPushed = true;
          this.complete = true;
        }
      });
    }
  }

  //
  // Readable stream implementation
  //

  _read(): void {
    if (!this.bodyPushed) {
      if (this.bodyBuffer && this.bodyBuffer.length > 0) {
        this.push(this.bodyBuffer);
      }
      this.push(null); // Signal end of stream
      this.bodyPushed = true;
      this.complete = true;
    }
  }

  //
  // Express helper methods
  //

  get(headerName: string): string | undefined {
    const key = headerName.toLowerCase();
    const value = this.headers[key];
    return Array.isArray(value) ? value[0] : value;
  }

  header(headerName: string): string | undefined {
    return this.get(headerName);
  }

  //
  // Private helpers
  //

  private normalizeHeaders(
    headers: Record<string, string>,
  ): IncomingHttpHeaders {
    const normalized: IncomingHttpHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }
}

//
//
// Helper Functions
//

/**
 * Normalize bracket notation in query parameter key.
 * Removes trailing `[]` from keys (e.g., `filterByStatus[]` → `filterByStatus`).
 */
function normalizeQueryKey(key: string): string {
  return key.endsWith("[]") ? key.slice(0, -2) : key;
}

/**
 * Parse a query string into a record with proper array handling.
 * Handles bracket notation (e.g., `param[]`) and multi-value parameters.
 */
function parseQueryString(
  queryString: string,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const params = new URLSearchParams(queryString);

  for (const [rawKey, value] of params) {
    const key = normalizeQueryKey(rawKey);
    const existing = result[key];

    if (existing === undefined) {
      // First occurrence - check if it's bracket notation to determine if it should be an array
      result[key] = rawKey.endsWith("[]") ? [value] : value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      // Convert to array when we encounter a second value
      result[key] = [existing, value];
    }
  }

  return result;
}

/**
 * Build query object from API Gateway v1 multiValueQueryStringParameters.
 * Normalizes bracket notation and preserves array values.
 */
function buildQueryFromMultiValue(
  multiValueParams: Record<string, string[]> | null | undefined,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  if (!multiValueParams) return result;

  for (const [rawKey, values] of Object.entries(multiValueParams)) {
    const key = normalizeQueryKey(rawKey);
    const existingValues = result[key];

    if (existingValues === undefined) {
      // First occurrence - use array if multiple values or bracket notation
      result[key] =
        values.length === 1 && !rawKey.endsWith("[]") ? values[0] : values;
    } else if (Array.isArray(existingValues)) {
      existingValues.push(...values);
    } else {
      // Convert to array and merge
      result[key] = [existingValues, ...values];
    }
  }

  return result;
}

//
//
// Type Guards
//

/**
 * Check if event is a Function URL / HTTP API v2 event.
 */
function isFunctionUrlEvent(event: LambdaEvent): event is FunctionUrlEvent {
  return "requestContext" in event && "http" in event.requestContext;
}

/**
 * Check if event is an API Gateway REST API v1 event.
 */
function isApiGatewayV1Event(event: LambdaEvent): event is ApiGatewayV1Event {
  return "httpMethod" in event;
}

//
//
// Factory Function
//

/**
 * Create a LambdaRequest from a Lambda event (Function URL, HTTP API v2, or REST API v1).
 */
export function createLambdaRequest(
  event: LambdaEvent,
  context: LambdaContext,
): LambdaRequest {
  let url: string;
  let method: string;
  let protocol: string;
  let query: Record<string, string | string[]> | undefined;
  let remoteAddress: string;
  const headers = { ...event.headers };

  if (isFunctionUrlEvent(event)) {
    // Function URL / HTTP API v2 format
    url = event.rawQueryString
      ? `${event.rawPath}?${event.rawQueryString}`
      : event.rawPath;
    method = event.requestContext.http.method;
    protocol = event.requestContext.http.protocol.split("/")[0].toLowerCase();
    remoteAddress = event.requestContext.http.sourceIp;

    // Parse query string with proper multi-value and bracket notation support
    if (event.rawQueryString) {
      query = parseQueryString(event.rawQueryString);
    }

    // Normalize cookies into Cookie header if not already present
    if (event.cookies && event.cookies.length > 0 && !headers.cookie) {
      headers.cookie = event.cookies.join("; ");
    }
  } else if (isApiGatewayV1Event(event)) {
    // API Gateway REST API v1 format
    // Use multiValueQueryStringParameters for proper array support
    const multiValueParams = event.multiValueQueryStringParameters;
    const queryParams = event.queryStringParameters;

    if (multiValueParams && Object.keys(multiValueParams).length > 0) {
      query = buildQueryFromMultiValue(multiValueParams);
    }

    // Build URL with query string
    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = new URLSearchParams(
        queryParams as Record<string, string>,
      ).toString();
      url = `${event.path}?${queryString}`;
    } else {
      url = event.path;
    }

    method = event.httpMethod;
    protocol = event.requestContext.protocol.split("/")[0].toLowerCase();
    remoteAddress = event.requestContext.identity.sourceIp;
  } else {
    throw new Error(
      "Unsupported Lambda event format. Expected Function URL, HTTP API v2, or REST API v1 event.",
    );
  }

  // Decode body if present
  let body: Buffer | null = null;
  if (event.body) {
    body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body, "utf8");

    // Add content-length header if not present (required for body parsers)
    const hasContentLength = Object.keys(headers).some(
      (k) => k.toLowerCase() === "content-length",
    );
    if (!hasContentLength) {
      headers["content-length"] = String(body.length);
    }
  }

  return new LambdaRequest({
    body,
    headers,
    lambdaContext: context,
    lambdaEvent: event,
    method,
    protocol,
    query,
    remoteAddress,
    url,
  });
}

export default LambdaRequest;
