import type { IncomingHttpHeaders } from "node:http";
import { Readable } from "node:stream";

import type { FunctionUrlEvent, LambdaContext } from "./types.js";

//
//
// Types
//

interface LambdaRequestOptions {
  body?: Buffer | null;
  headers: Record<string, string>;
  lambdaContext: LambdaContext;
  lambdaEvent: FunctionUrlEvent;
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
  public readonly _lambdaEvent: FunctionUrlEvent;

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
// Factory Function
//

/**
 * Create a LambdaRequest from a Function URL event.
 */
export function createLambdaRequest(
  event: FunctionUrlEvent,
  context: LambdaContext,
): LambdaRequest {
  // Build URL with query string
  const url = event.rawQueryString
    ? `${event.rawPath}?${event.rawQueryString}`
    : event.rawPath;

  // Decode body if present
  let body: Buffer | null = null;
  if (event.body) {
    body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body, "utf8");
  }

  // Normalize cookies into Cookie header if not already present
  const headers = { ...event.headers };
  if (event.cookies && event.cookies.length > 0 && !headers.cookie) {
    headers.cookie = event.cookies.join("; ");
  }

  return new LambdaRequest({
    body,
    headers,
    lambdaContext: context,
    lambdaEvent: event,
    method: event.requestContext.http.method,
    protocol: event.requestContext.http.protocol.split("/")[0].toLowerCase(),
    remoteAddress: event.requestContext.http.sourceIp,
    url,
  });
}

export default LambdaRequest;
