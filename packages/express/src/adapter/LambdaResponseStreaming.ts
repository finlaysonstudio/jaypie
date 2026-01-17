import type { OutgoingHttpHeaders } from "node:http";
import { ServerResponse } from "node:http";
import { Writable } from "node:stream";

import type {
  AwsLambdaGlobal,
  HttpResponseStreamMetadata,
  ResponseStream,
} from "./types.js";

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

//
//
// Declare awslambda global (provided by Lambda runtime)
//

declare const awslambda: AwsLambdaGlobal;

//
//
// Types
//

interface PendingWrite {
  callback: () => void;
  chunk: Buffer;
}

//
//
// LambdaResponseStreaming Class
//

/**
 * Mock ServerResponse that streams directly to Lambda responseStream.
 * Uses awslambda.HttpResponseStream.from() to set status and headers.
 */
export class LambdaResponseStreaming extends Writable {
  public statusCode: number = 200;
  public statusMessage: string = "OK";

  // Mock socket to satisfy Express/finalhandler checks
  public readonly socket: { remoteAddress: string } = {
    remoteAddress: "127.0.0.1",
  };

  // Internal state exposed for direct manipulation by safe response methods
  // that need to bypass dd-trace interception
  public _headers: Map<string, string | string[]> = new Map();
  public _headersSent: boolean = false;
  private _pendingWrites: PendingWrite[] = [];
  private _responseStream: ResponseStream;
  private _wrappedStream: ResponseStream | null = null;

  constructor(responseStream: ResponseStream) {
    super();
    this._responseStream = responseStream;
    // Initialize Node's internal kOutHeaders for dd-trace compatibility.
    // dd-trace patches HTTP methods and expects this internal state.
    if (kOutHeaders) {
      (this as Record<symbol, unknown>)[kOutHeaders] = Object.create(null);
    }
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
  // Header management
  //

  setHeader(name: string, value: number | string | string[]): this {
    if (this._headersSent) {
      // In streaming mode, log warning but don't throw
      // Headers cannot be changed after body starts
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
    if (!this._headersSent) {
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
          if (!this._headersSent) {
            this._headers.delete(String(prop).toLowerCase());
          }
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
    if (this._headersSent) {
      return this;
    }

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

    this.flushHeaders();
    return this;
  }

  get headersSent(): boolean {
    return this._headersSent;
  }

  flushHeaders(): void {
    if (this._headersSent) return;

    const headers: Record<string, string> = {};
    for (const [key, value] of this._headers) {
      headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }

    const metadata: HttpResponseStreamMetadata = {
      headers,
      statusCode: this.statusCode,
    };

    // Wrap the stream with metadata using awslambda global
    this._wrappedStream = awslambda.HttpResponseStream.from(
      this._responseStream,
      metadata,
    );
    this._headersSent = true;

    // Flush pending writes
    for (const { callback, chunk } of this._pendingWrites) {
      this._wrappedStream.write(chunk);
      callback();
    }
    this._pendingWrites = [];
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

    if (!this._headersSent) {
      // Buffer writes until headers are sent
      this._pendingWrites.push({ callback: () => callback(), chunk: buffer });
      // Auto-flush headers on first write
      this.flushHeaders();
    } else {
      this._wrappedStream!.write(buffer);
      callback();
    }
  }

  _final(callback: (error?: Error | null) => void): void {
    if (!this._headersSent) {
      this.flushHeaders();
    }
    this._wrappedStream?.end();
    callback();
  }
}

export default LambdaResponseStreaming;
