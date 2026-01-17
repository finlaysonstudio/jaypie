import type { OutgoingHttpHeaders } from "node:http";
import { ServerResponse } from "node:http";
import { Writable } from "node:stream";

import type { LambdaResponse } from "./types.js";

//
//
// Constants
//

// Get Node's internal kOutHeaders symbol from ServerResponse prototype.
// This is needed for compatibility with Datadog dd-trace instrumentation,
// which patches HTTP methods and expects this internal state to exist.
const kOutHeaders = Object.getOwnPropertySymbols(ServerResponse.prototype).find(
  (s) => s.toString() === "Symbol(kOutHeaders)",
);

const BINARY_CONTENT_TYPE_PATTERNS = [
  /^application\/octet-stream$/,
  /^application\/pdf$/,
  /^application\/zip$/,
  /^audio\//,
  /^font\//,
  /^image\//,
  /^video\//,
];

//
//
// LambdaResponseBuffered Class
//

/**
 * Mock ServerResponse that buffers the response.
 * Collects status, headers, and body chunks, then returns a Lambda response.
 */
export class LambdaResponseBuffered extends Writable {
  public statusCode: number = 200;
  public statusMessage: string = "OK";

  // Mock socket to satisfy Express/finalhandler checks
  public readonly socket: { remoteAddress: string } = {
    remoteAddress: "127.0.0.1",
  };

  // Internal state exposed for direct manipulation by safe response methods
  // that need to bypass dd-trace interception of stream methods
  public _chunks: Buffer[] = [];
  public _ended: boolean = false; // Track ended state since writableEnded is lost after prototype change
  public _headers: Map<string, string | string[]> = new Map();
  public _headersSent: boolean = false;
  public _resolve: ((result: LambdaResponse) => void) | null = null;

  constructor() {
    super();
    // Initialize Node's internal kOutHeaders for dd-trace compatibility.
    // dd-trace patches HTTP methods and expects this internal state.
    if (kOutHeaders) {
      (this as Record<symbol, unknown>)[kOutHeaders] = Object.create(null);
    }

    // CRITICAL: Define key methods as instance properties to survive Express's
    // setPrototypeOf(res, app.response) in middleware/init.js which would
    // otherwise replace our prototype with ServerResponse.prototype.
    // Instance properties take precedence over prototype properties.
    this.getHeader = this.getHeader.bind(this);
    this.setHeader = this.setHeader.bind(this);
    this.removeHeader = this.removeHeader.bind(this);
    this.hasHeader = this.hasHeader.bind(this);
    this.getHeaders = this.getHeaders.bind(this);
    this.getHeaderNames = this.getHeaderNames.bind(this);
    this.writeHead = this.writeHead.bind(this);
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.status = this.status.bind(this);
    this.json = this.json.bind(this);
    this.send = this.send.bind(this);
    this.vary = this.vary.bind(this);
    this.end = this.end.bind(this);
    this.write = this.write.bind(this);
    // Also bind internal Writable methods that are called via prototype chain
    this._write = this._write.bind(this);
    this._final = this._final.bind(this);
    // Bind result-building methods
    this.getResult = this.getResult.bind(this);
    this.buildResult = this.buildResult.bind(this);
    this.isBinaryContentType = this.isBinaryContentType.bind(this);
  }

  //
  // Internal bypass methods - completely avoid prototype chain lookup
  // These directly access _headers Map, safe from dd-trace interception
  //

  _internalGetHeader(name: string): string | undefined {
    const value = this._headers.get(name.toLowerCase());
    return value ? String(value) : undefined;
  }

  _internalSetHeader(name: string, value: string): void {
    if (!this._headersSent) {
      const lowerName = name.toLowerCase();
      this._headers.set(lowerName, value);
      // Also sync kOutHeaders for any code that expects it
      if (kOutHeaders) {
        const outHeaders = (
          this as unknown as Record<symbol, Record<string, unknown>>
        )[kOutHeaders];
        if (outHeaders) {
          outHeaders[lowerName] = [name, value];
        }
      }
    }
  }

  _internalHasHeader(name: string): boolean {
    return this._headers.has(name.toLowerCase());
  }

  _internalRemoveHeader(name: string): void {
    if (!this._headersSent) {
      const lowerName = name.toLowerCase();
      this._headers.delete(lowerName);
      if (kOutHeaders) {
        const outHeaders = (
          this as unknown as Record<symbol, Record<string, unknown>>
        )[kOutHeaders];
        if (outHeaders) {
          delete outHeaders[lowerName];
        }
      }
    }
  }

  //
  // Promise-based API for getting final result
  //

  getResult(): Promise<LambdaResponse> {
    return new Promise((resolve) => {
      // Use _ended instead of writableEnded since Express's setPrototypeOf breaks the getter
      if (this._ended) {
        resolve(this.buildResult());
      } else {
        this._resolve = resolve;
      }
    });
  }

  //
  // Header management
  //

  setHeader(name: string, value: number | string | string[]): this {
    if (this._headersSent) {
      // In production, log warning but don't throw to match Express behavior
      return this;
    }
    const lowerName = name.toLowerCase();
    this._headers.set(lowerName, String(value));
    // Sync with kOutHeaders for dd-trace compatibility
    // Node stores as { 'header-name': ['Header-Name', value] }
    if (kOutHeaders) {
      const outHeaders = (
        this as unknown as Record<symbol, Record<string, unknown>>
      )[kOutHeaders];
      if (outHeaders) {
        outHeaders[lowerName] = [name, String(value)];
      }
    }
    return this;
  }

  getHeader(name: string): number | string | string[] | undefined {
    return this._headers.get(name.toLowerCase());
  }

  removeHeader(name: string): void {
    const lowerName = name.toLowerCase();
    this._headers.delete(lowerName);
    // Sync with kOutHeaders for dd-trace compatibility
    if (kOutHeaders) {
      const outHeaders = (
        this as unknown as Record<symbol, Record<string, unknown>>
      )[kOutHeaders];
      if (outHeaders) {
        delete outHeaders[lowerName];
      }
    }
  }

  getHeaders(): OutgoingHttpHeaders {
    const headers: OutgoingHttpHeaders = {};
    for (const [key, value] of this._headers) {
      headers[key] = value;
    }
    return headers;
  }

  hasHeader(name: string): boolean {
    return this._headers.has(name.toLowerCase());
  }

  getHeaderNames(): string[] {
    return Array.from(this._headers.keys());
  }

  /**
   * Proxy for direct header access (e.g., res.headers['content-type']).
   * Required for compatibility with middleware like helmet that access headers directly.
   * Uses direct _headers access to bypass dd-trace interception.
   */
  get headers(): Record<string, string | string[] | undefined> {
    return new Proxy(
      {},
      {
        deleteProperty: (_target, prop) => {
          this._headers.delete(String(prop).toLowerCase());
          return true;
        },
        get: (_target, prop) => {
          if (typeof prop === "symbol") return undefined;
          return this._headers.get(String(prop).toLowerCase());
        },
        getOwnPropertyDescriptor: (_target, prop) => {
          const lowerProp = String(prop).toLowerCase();
          if (this._headers.has(lowerProp)) {
            return {
              configurable: true,
              enumerable: true,
              value: this._headers.get(lowerProp),
            };
          }
          return undefined;
        },
        has: (_target, prop) => {
          return this._headers.has(String(prop).toLowerCase());
        },
        ownKeys: () => {
          return Array.from(this._headers.keys());
        },
        set: (_target, prop, value) => {
          if (!this._headersSent) {
            this._headers.set(String(prop).toLowerCase(), value);
          }
          return true;
        },
      },
    );
  }

  writeHead(
    statusCode: number,
    statusMessageOrHeaders?: OutgoingHttpHeaders | string,
    headers?: OutgoingHttpHeaders,
  ): this {
    this.statusCode = statusCode;

    let headersToSet: OutgoingHttpHeaders | undefined;

    if (typeof statusMessageOrHeaders === "string") {
      this.statusMessage = statusMessageOrHeaders;
      headersToSet = headers;
    } else if (
      statusMessageOrHeaders &&
      typeof statusMessageOrHeaders === "object"
    ) {
      headersToSet = statusMessageOrHeaders;
    }

    if (headersToSet) {
      // Use direct _headers access to bypass dd-trace interception
      for (const [key, value] of Object.entries(headersToSet)) {
        if (value !== undefined) {
          this._headers.set(key.toLowerCase(), String(value));
        }
      }
    }

    this._headersSent = true;
    return this;
  }

  get headersSent(): boolean {
    return this._headersSent;
  }

  //
  // Express compatibility methods
  //

  /**
   * Express-style alias for getHeader().
   * Used by middleware like decorateResponse that use res.get().
   * Note: Directly accesses _headers to avoid prototype chain issues with bundled code.
   */
  get(name: string): number | string | string[] | undefined {
    return this._headers.get(name.toLowerCase());
  }

  /**
   * Express-style alias for setHeader().
   * Used by middleware like decorateResponse that use res.set().
   * Note: Directly accesses _headers to avoid prototype chain issues with bundled code.
   */
  set(name: string, value: number | string | string[]): this {
    if (!this._headersSent) {
      this._headers.set(name.toLowerCase(), String(value));
    }
    return this;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(data: unknown): this {
    // Use direct _headers access to bypass dd-trace interception
    this._headers.set("content-type", "application/json");
    this.end(JSON.stringify(data));
    return this;
  }

  send(body?: Buffer | object | string): this {
    if (typeof body === "object" && !Buffer.isBuffer(body)) {
      return this.json(body);
    }
    this.end(body);
    return this;
  }

  /**
   * Add a field to the Vary response header.
   * Used by CORS middleware to indicate response varies by Origin.
   * Uses direct _headers access to bypass dd-trace interception.
   */
  vary(field: string): this {
    const existing = this._headers.get("vary");
    if (!existing) {
      this._headers.set("vary", field);
    } else {
      // Append to existing Vary header if field not already present
      const fields = String(existing)
        .split(",")
        .map((f) => f.trim().toLowerCase());
      if (!fields.includes(field.toLowerCase())) {
        this._headers.set("vary", `${existing}, ${field}`);
      }
    }
    return this;
  }

  //
  // Writable stream implementation
  //

  _write(
    chunk: Buffer | string,
    encoding: BufferEncoding, // eslint-disable-line no-undef
    callback: (error?: Error | null) => void,
  ): void {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk, encoding);
    this._chunks.push(buffer);
    this._headersSent = true;
    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    this._ended = true;
    if (this._resolve) {
      this._resolve(this.buildResult());
    }
    callback();
  }

  //
  // Private helpers
  //

  public buildResult(): LambdaResponse {
    const body = Buffer.concat(this._chunks);
    // Use direct _headers access to bypass dd-trace interception
    const contentType = (this._headers.get("content-type") as string) || "";

    // Determine if response should be base64 encoded
    const isBase64Encoded = this.isBinaryContentType(contentType);

    // Build headers object
    const headers: Record<string, string> = {};
    const cookies: string[] = [];

    for (const [key, value] of this._headers) {
      if (key === "set-cookie") {
        // Collect Set-Cookie headers for v2 response format
        if (Array.isArray(value)) {
          cookies.push(...value);
        } else {
          cookies.push(value);
        }
      } else {
        headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
      }
    }

    const result: LambdaResponse = {
      body: isBase64Encoded ? body.toString("base64") : body.toString("utf8"),
      headers,
      isBase64Encoded,
      statusCode: this.statusCode,
    };

    // Only include cookies if present (v2 format)
    if (cookies.length > 0) {
      result.cookies = cookies;
    }

    return result;
  }

  private isBinaryContentType(contentType: string): boolean {
    return BINARY_CONTENT_TYPE_PATTERNS.some((pattern) =>
      pattern.test(contentType),
    );
  }
}

export default LambdaResponseBuffered;
