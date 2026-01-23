import { createMockFunction } from "./utils";
import { jaypieHandler } from "./core";

// We'll use more specific types instead of Function
type HandlerFunction = (...args: unknown[]) => unknown;
type LifecycleFunction = (...args: unknown[]) => unknown | Promise<unknown>;

export interface LambdaOptions {
  name?: string;
  setup?: LifecycleFunction | LifecycleFunction[];
  teardown?: LifecycleFunction | LifecycleFunction[];
  throw?: boolean;
  unavailable?: boolean;
  validate?: LifecycleFunction | LifecycleFunction[];
  [key: string]: unknown;
}

// Mock implementation of lambdaHandler that follows the original implementation pattern
export const lambdaHandler = createMockFunction<
  (handler: HandlerFunction, props?: LambdaOptions) => HandlerFunction
>((handler, props = {}) => {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof props === "function") {
    const temp = handler;
    handler = props;
    props = temp;
  }
  return async (event: unknown, context: unknown, ...extra: unknown[]) => {
    return jaypieHandler(handler, props)(event, context, ...extra);
  };
});

// Mock stream handler function type
type StreamHandlerFunction = (
  event: unknown,
  responseStream: { write: (data: string) => void; end: () => void },
  context: unknown,
  ...extra: unknown[]
) => Promise<void>;

// Mock implementation of lambdaStreamHandler
export const lambdaStreamHandler = createMockFunction<
  (
    handler: StreamHandlerFunction,
    props?: LambdaOptions,
  ) => StreamHandlerFunction
>((handler, props = {}) => {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof props === "function") {
    const temp = handler;
    handler = props;
    props = temp;
  }
  return async (
    event: unknown,
    responseStream: { write: (data: string) => void; end: () => void },
    context: unknown,
    ...extra: unknown[]
  ) => {
    try {
      await handler(event, responseStream, context, ...extra);
    } finally {
      try {
        responseStream.end();
      } catch {
        // Response stream may already be ended
      }
    }
  };
});

// Mock WebSocket handler function type
type WebSocketHandlerFunction = (
  event: unknown,
  context: WebSocketContext,
  ...extra: unknown[]
) => Promise<WebSocketResponse>;

// Mock WebSocket context
export interface WebSocketContext {
  awsRequestId?: string;
  body: string | null;
  broadcast: (
    connectionIds: string[],
    data: unknown,
  ) => Promise<{ staleConnections: string[]; successCount: number }>;
  connectionId: string;
  domainName: string;
  queryStringParameters: Record<string, string> | null;
  routeKey: string;
  send: (data: unknown) => Promise<{ connectionValid: boolean; success: boolean }>;
  stage: string;
}

// Mock WebSocket response
export interface WebSocketResponse {
  body?: string;
  statusCode: number;
}

// Mock implementation of websocketHandler
export const websocketHandler = createMockFunction<
  (
    handler: WebSocketHandlerFunction,
    props?: LambdaOptions,
  ) => (
    event: unknown,
    context?: unknown,
    ...args: unknown[]
  ) => Promise<WebSocketResponse>
>((handler, props = {}) => {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof props === "function") {
    const temp = handler;
    handler = props;
    props = temp;
  }
  return async (event: unknown, context: unknown = {}, ...extra: unknown[]) => {
    // Create a mock WebSocket context
    const wsContext: WebSocketContext = {
      awsRequestId: (context as Record<string, string>)?.awsRequestId,
      body: (event as Record<string, string | null>)?.body ?? null,
      broadcast: async () => ({ staleConnections: [], successCount: 0 }),
      connectionId: "mock-connection-id",
      domainName: "ws.example.com",
      queryStringParameters:
        ((event as Record<string, unknown>)?.queryStringParameters as Record<
          string,
          string
        >) ?? null,
      routeKey:
        ((event as Record<string, unknown>)?.requestContext as Record<
          string,
          string
        >)?.routeKey ?? "$default",
      send: async () => ({ connectionValid: true, success: true }),
      stage: "production",
    };
    return handler(event, wsContext, ...extra);
  };
});
