import type { OutgoingHttpHeaders } from "node:http";
import { Writable } from "node:stream";

import type { LambdaResponse } from "./types.js";

//
//
// Constants
//

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

  private _chunks: Buffer[] = [];
  private _headers: Map<string, string | string[]> = new Map();
  private _headersSent: boolean = false;
  private _resolve: ((result: LambdaResponse) => void) | null = null;

  constructor() {
    super();
  }

  //
  // Promise-based API for getting final result
  //

  getResult(): Promise<LambdaResponse> {
    return new Promise((resolve) => {
      if (this.writableEnded) {
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
    this._headers.set(name.toLowerCase(), String(value));
    return this;
  }

  getHeader(name: string): number | string | string[] | undefined {
    return this._headers.get(name.toLowerCase());
  }

  removeHeader(name: string): void {
    this._headers.delete(name.toLowerCase());
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
   */
  get headers(): Record<string, string | string[] | undefined> {
    return new Proxy(
      {},
      {
        deleteProperty: (_target, prop) => {
          this.removeHeader(String(prop));
          return true;
        },
        get: (_target, prop) => {
          if (typeof prop === "symbol") return undefined;
          return this.getHeader(String(prop));
        },
        getOwnPropertyDescriptor: (_target, prop) => {
          if (this.hasHeader(String(prop))) {
            return {
              configurable: true,
              enumerable: true,
              value: this.getHeader(String(prop)),
            };
          }
          return undefined;
        },
        has: (_target, prop) => {
          return this.hasHeader(String(prop));
        },
        ownKeys: () => {
          return this.getHeaderNames();
        },
        set: (_target, prop, value) => {
          this.setHeader(String(prop), value);
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
      for (const [key, value] of Object.entries(headersToSet)) {
        if (value !== undefined) {
          this.setHeader(key, value as string);
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
    this.setHeader("content-type", "application/json");
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
   */
  vary(field: string): this {
    const existing = this.getHeader("vary");
    if (!existing) {
      this.setHeader("vary", field);
    } else {
      // Append to existing Vary header if field not already present
      const fields = String(existing)
        .split(",")
        .map((f) => f.trim().toLowerCase());
      if (!fields.includes(field.toLowerCase())) {
        this.setHeader("vary", `${existing}, ${field}`);
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
    if (this._resolve) {
      this._resolve(this.buildResult());
    }
    callback();
  }

  //
  // Private helpers
  //

  private buildResult(): LambdaResponse {
    const body = Buffer.concat(this._chunks);
    const contentType = (this.getHeader("content-type") as string) || "";

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
