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

    // Parse query string from URL
    const queryIndex = options.url.indexOf("?");
    if (queryIndex !== -1) {
      const queryString = options.url.slice(queryIndex + 1);
      const params = new URLSearchParams(queryString);
      for (const [key, value] of params) {
        this.query[key] = value;
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

    // Normalize cookies into Cookie header if not already present
    if (event.cookies && event.cookies.length > 0 && !headers.cookie) {
      headers.cookie = event.cookies.join("; ");
    }
  } else if (isApiGatewayV1Event(event)) {
    // API Gateway REST API v1 format
    const queryParams = event.queryStringParameters;
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
    remoteAddress,
    url,
  });
}

export default LambdaRequest;
