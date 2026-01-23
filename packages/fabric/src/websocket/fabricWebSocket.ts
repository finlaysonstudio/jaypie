// WebSocket Service adapter for @jaypie/fabric

import { websocketHandler } from "@jaypie/lambda";
import type {
  BroadcastResult,
  SendResult,
  WebSocketContext,
  WebSocketEvent,
  WebSocketHandlerOptions,
  WebSocketResponse,
} from "@jaypie/lambda";

import { resolveService } from "../resolveService.js";
import type {
  InputFieldDefinition,
  Message,
  Service,
  ServiceContext,
  ServiceFunction,
} from "../types.js";

//
//
// Types
//

/** Callback called when handler completes successfully */
export type OnCompleteCallback = (response: unknown) => void | Promise<void>;

/** Callback called for recoverable errors (via context.onError) */
export type OnErrorCallback = (error: unknown) => void | Promise<void>;

/** Callback called for fatal errors (thrown or via context.onFatal) */
export type OnFatalCallback = (error: unknown) => void | Promise<void>;

/** Callback for receiving messages from service during execution */
export type OnMessageCallback = (message: Message) => void | Promise<void>;

/** Callback for $connect event */
export type OnConnectCallback = (
  context: WebSocketContext,
) => void | Promise<void>;

/** Callback for $disconnect event */
export type OnDisconnectCallback = (
  context: WebSocketContext,
) => void | Promise<void>;

type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;
type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Extended service context for WebSocket handlers
 */
export interface WebSocketServiceContext extends ServiceContext {
  /** Broadcast data to multiple connections */
  broadcast: (
    connectionIds: string[],
    data: unknown,
  ) => Promise<BroadcastResult>;
  /** The WebSocket connection ID */
  connectionId: string;
  /** The WebSocket API domain name */
  domainName: string;
  /** Query string parameters from $connect */
  queryStringParameters: Record<string, string> | null;
  /** The route key (e.g., "$connect", "$disconnect", "$default", or custom) */
  routeKey: string;
  /** Send data to the current connection */
  send: (data: unknown) => Promise<SendResult>;
  /** The WebSocket API stage */
  stage: string;
}

/**
 * Options for fabricWebSocket
 */
export interface FabricWebSocketOptions {
  /** Chaos testing mode */
  chaos?: string;
  /** Override the service name for logging (defaults to service.alias) */
  name?: string;
  /** Callback for $connect events */
  onConnect?: OnConnectCallback;
  /** Callback called when handler completes successfully */
  onComplete?: OnCompleteCallback;
  /** Callback for $disconnect events */
  onDisconnect?: OnDisconnectCallback;
  /** Callback for recoverable errors (via context.onError) */
  onError?: OnErrorCallback;
  /** Callback for fatal errors (thrown or via context.onFatal) */
  onFatal?: OnFatalCallback;
  /** Callback for receiving messages from service during execution */
  onMessage?: OnMessageCallback;
  /** AWS secrets to load into process.env */
  secrets?: string[];
  /** Functions to run before handler */
  setup?: LifecycleFunction[];
  /** Functions to run after handler (always runs) */
  teardown?: LifecycleFunction[];
  /** Re-throw errors instead of returning error response */
  throw?: boolean;
  /** Return 503 Unavailable immediately */
  unavailable?: boolean;
  /** Validation functions to run before handler */
  validate?: ValidatorFunction[];
}

/**
 * Configuration for fabricWebSocket
 */
export interface FabricWebSocketConfig extends FabricWebSocketOptions {
  /** Service alias (used as name for logging if `name` not provided) */
  alias?: string;
  /** Service description */
  description?: string;
  /** Input field definitions */
  input?: Record<string, InputFieldDefinition>;
  /** The service - either a pre-instantiated Service or an inline function */
  service: Service | ServiceFunction<Record<string, unknown>, unknown>;
}

/**
 * The returned WebSocket Lambda handler function
 */
export type FabricWebSocketResult = (
  event: WebSocketEvent,
  context?: { awsRequestId?: string; [key: string]: unknown },
  ...args: unknown[]
) => Promise<WebSocketResponse>;

/**
 * Type guard to check if a value is a pre-instantiated Service
 */
function isService(value: unknown): value is Service {
  return typeof value === "function" && "$fabric" in value;
}

/**
 * Type guard to check if a value is a config object
 */
function isConfig(value: unknown): value is FabricWebSocketConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "service" in value &&
    typeof (value as FabricWebSocketConfig).service === "function"
  );
}

/**
 * Fabric a WebSocket Lambda handler that wraps a service.
 *
 * This function creates a WebSocket-compatible Lambda handler that:
 * - Parses the WebSocket body as service input
 * - Provides WebSocket context (connectionId, send, broadcast) to the service
 * - Handles $connect and $disconnect events with optional callbacks
 * - Integrates with websocketHandler for lifecycle management
 *
 * @example
 * ```typescript
 * import { fabricWebSocket } from "@jaypie/fabric/websocket";
 * import { myService } from "./services";
 *
 * // Direct service style
 * export const handler = fabricWebSocket(myService);
 *
 * // Config object style with lifecycle hooks
 * export const handler2 = fabricWebSocket({
 *   service: myService,
 *   secrets: ["MONGODB_URI"],
 *   onConnect: async (context) => {
 *     await storeConnection(context.connectionId);
 *   },
 *   onDisconnect: async (context) => {
 *     await removeConnection(context.connectionId);
 *   },
 * });
 * ```
 */
export function fabricWebSocket(
  serviceOrConfig:
    | FabricWebSocketConfig
    | Service
    | ServiceFunction<Record<string, unknown>, unknown>,
  options: FabricWebSocketOptions = {},
): FabricWebSocketResult {
  // Normalize arguments and resolve service
  let service: Service;
  let opts: FabricWebSocketOptions;

  if (isConfig(serviceOrConfig)) {
    const {
      alias,
      description,
      input,
      service: configService,
      ...configOpts
    } = serviceOrConfig;
    service = resolveService({
      alias,
      description,
      input,
      service: configService,
    });
    opts = configOpts;
  } else if (isService(serviceOrConfig)) {
    service = serviceOrConfig;
    opts = options;
  } else {
    service = resolveService({ service: serviceOrConfig });
    opts = options;
  }

  const name = opts.name ?? service.alias;

  // Create context callbacks with error swallowing
  const sendMessage = opts.onMessage
    ? async (message: Message): Promise<void> => {
        try {
          await opts.onMessage!(message);
        } catch {
          // Swallow errors
        }
      }
    : undefined;

  const contextOnError = opts.onError
    ? async (error: unknown): Promise<void> => {
        try {
          await opts.onError!(error);
        } catch {
          // Swallow errors
        }
      }
    : undefined;

  const contextOnFatal = opts.onFatal
    ? async (error: unknown): Promise<void> => {
        try {
          await opts.onFatal!(error);
        } catch {
          // Swallow errors
        }
      }
    : undefined;

  // Create the WebSocket handler
  const innerHandler = async (
    event: WebSocketEvent,
    wsContext: WebSocketContext,
  ): Promise<WebSocketResponse> => {
    const { body, routeKey } = wsContext;

    // Handle $connect
    if (routeKey === "$connect") {
      if (opts.onConnect) {
        try {
          await opts.onConnect(wsContext);
        } catch {
          // Connection rejected
          return { statusCode: 401 };
        }
      }
      return { statusCode: 200 };
    }

    // Handle $disconnect
    if (routeKey === "$disconnect") {
      if (opts.onDisconnect) {
        try {
          await opts.onDisconnect(wsContext);
        } catch {
          // Swallow errors on disconnect
        }
      }
      return { statusCode: 200 };
    }

    // Handle messages ($default or custom routes)
    // Parse body as service input
    let input: Record<string, unknown> = {};
    if (body) {
      try {
        input = JSON.parse(body);
      } catch {
        // If body is not JSON, use it as a string input
        input = { body };
      }
    }

    // Build extended service context
    const serviceContext: WebSocketServiceContext = {
      broadcast: wsContext.broadcast,
      connectionId: wsContext.connectionId,
      domainName: wsContext.domainName,
      onError: contextOnError,
      onFatal: contextOnFatal,
      queryStringParameters: wsContext.queryStringParameters,
      routeKey: wsContext.routeKey,
      send: wsContext.send,
      sendMessage,
      stage: wsContext.stage,
    };

    // Call the service
    try {
      const result = await service(input, serviceContext);

      // Call onComplete if provided
      if (opts.onComplete) {
        try {
          await opts.onComplete(result);
        } catch {
          // Swallow errors
        }
      }

      // Return success
      return {
        body: result !== undefined ? JSON.stringify(result) : undefined,
        statusCode: 200,
      };
    } catch (error) {
      // Call onFatal or onError
      if (opts.onFatal) {
        await opts.onFatal(error);
      } else if (opts.onError) {
        await opts.onError(error);
      }
      // Re-throw to let websocketHandler handle it
      throw error;
    }
  };

  // Wrap with websocketHandler for lifecycle management
  return websocketHandler(innerHandler, {
    chaos: opts.chaos,
    name,
    secrets: opts.secrets,
    setup: opts.setup,
    teardown: opts.teardown,
    throw: opts.throw,
    unavailable: opts.unavailable,
    validate: opts.validate,
  } as WebSocketHandlerOptions);
}
