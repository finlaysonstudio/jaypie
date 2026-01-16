import type { OutgoingHttpHeaders } from "node:http";
import { Writable } from "node:stream";

import type {
  AwsLambdaGlobal,
  HttpResponseStreamMetadata,
  ResponseStream,
} from "./types.js";

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

  private _headers: Map<string, string | string[]> = new Map();
  private _headersSent: boolean = false;
  private _pendingWrites: PendingWrite[] = [];
  private _responseStream: ResponseStream;
  private _wrappedStream: ResponseStream | null = null;

  constructor(responseStream: ResponseStream) {
    super();
    this._responseStream = responseStream;
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
    this._headers.set(name.toLowerCase(), String(value));
    return this;
  }

  getHeader(name: string): number | string | string[] | undefined {
    return this._headers.get(name.toLowerCase());
  }

  removeHeader(name: string): void {
    if (!this._headersSent) {
      this._headers.delete(name.toLowerCase());
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
      for (const [key, value] of Object.entries(headersToSet)) {
        if (value !== undefined) {
          this.setHeader(key, value as string);
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
