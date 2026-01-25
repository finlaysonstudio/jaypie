import {
  broadcastToConnections,
  loadEnvSecrets,
  sendToConnection,
} from "@jaypie/aws";
import { ConfigurationError, UnhandledError } from "@jaypie/errors";
import { JAYPIE, jaypieHandler } from "@jaypie/kit";
import { log as publicLogger } from "@jaypie/logger";

//
//
// Types
//

export interface WebSocketEvent {
  body?: string | null;
  headers?: Record<string, string>;
  isBase64Encoded?: boolean;
  multiValueHeaders?: Record<string, string[]>;
  queryStringParameters?: Record<string, string> | null;
  requestContext: {
    connectionId: string;
    domainName: string;
    eventType?: "CONNECT" | "DISCONNECT" | "MESSAGE";
    routeKey: string;
    stage: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface WebSocketContext {
  awsRequestId?: string;
  body: string | null;
  broadcast: (
    connectionIds: string[],
    data: unknown,
  ) => Promise<BroadcastResult>;
  connectionId: string;
  domainName: string;
  queryStringParameters: Record<string, string> | null;
  routeKey: string;
  send: (data: unknown) => Promise<SendResult>;
  stage: string;
  [key: string]: unknown;
}

export interface SendResult {
  /** Whether the connection is still valid */
  connectionValid: boolean;
  /** Whether the send was successful */
  success: boolean;
}

export interface BroadcastResult {
  /** Connection IDs that are no longer valid */
  staleConnections: string[];
  /** Total number of successful sends */
  successCount: number;
}

export interface WebSocketResponse {
  body?: string;
  statusCode: number;
}

type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;
type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;

export interface WebSocketHandlerOptions {
  chaos?: string;
  name?: string;
  secrets?: string[];
  setup?: LifecycleFunction[];
  teardown?: LifecycleFunction[];
  throw?: boolean;
  unavailable?: boolean;
  validate?: ValidatorFunction[];
}

export type WebSocketHandlerFunction<TResult = WebSocketResponse> = (
  event: WebSocketEvent,
  context: WebSocketContext,
  ...args: unknown[]
) => Promise<TResult> | TResult;

interface JaypieError extends Error {
  body: () => unknown;
  isProjectError?: boolean;
  json: () => unknown;
}

interface JaypieLogger {
  init: () => void;
  level: string;
  lib: (options: Record<string, unknown>) => JaypieLibLogger;
  tag: (tags: Record<string, unknown>) => void;
  untag: (tag: string) => void;
}

interface JaypieLibLogger {
  debug: (message: string) => void;
  fatal: (message: string) => void;
  info: {
    var: (data: Record<string, unknown>) => void;
  };
  trace: (message: string) => void;
}

//
//
// Main
//

const websocketHandler = function <TResult = WebSocketResponse>(
  handler: WebSocketHandlerFunction<TResult> | WebSocketHandlerOptions,
  options: WebSocketHandlerOptions | WebSocketHandlerFunction<TResult> = {},
): (
  event: WebSocketEvent,
  context?: { awsRequestId?: string; [key: string]: unknown },
  ...args: unknown[]
) => Promise<TResult> {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof options === "function") {
    const temp = handler;
    handler = options;
    options = temp;
  }

  const opts = options as WebSocketHandlerOptions;
  let {
    chaos,
    name,
    secrets,
    setup = [],
    teardown,
    throw: shouldThrow = false,
    unavailable,
    validate,
  } = opts;

  // Add secrets loading to setup if secrets are provided
  if (secrets && secrets.length > 0) {
    const secretsToLoad = secrets;
    const secretsSetup: LifecycleFunction = async () => {
      await loadEnvSecrets(...secretsToLoad);
    };
    setup = [secretsSetup, ...setup];
  }

  //
  //
  // Validate
  //

  if (typeof handler !== "function") {
    throw new ConfigurationError(
      "The handler responding to the request encountered a configuration error",
    );
  }

  //
  //
  // Setup
  //

  return async (
    event: WebSocketEvent,
    lambdaContext: { awsRequestId?: string; [key: string]: unknown } = {},
    ...args: unknown[]
  ): Promise<TResult> => {
    if (!name) {
      // If handler has a name, use it
      if ((handler as WebSocketHandlerFunction).name) {
        name = (handler as WebSocketHandlerFunction).name;
      } else {
        name = JAYPIE.UNKNOWN;
      }
    }

    // Re-init the logger
    (publicLogger as unknown as JaypieLogger).init();

    // The public logger is also the "root" logger
    if (lambdaContext.awsRequestId) {
      (publicLogger as unknown as JaypieLogger).tag({
        invoke: lambdaContext.awsRequestId,
      });
      (publicLogger as unknown as JaypieLogger).tag({
        shortInvoke: lambdaContext.awsRequestId.slice(0, 8),
      });
    }
    (publicLogger as unknown as JaypieLogger).tag({ handler: name });

    // Very low-level, sub-trace details
    const libLogger = (publicLogger as unknown as JaypieLogger).lib({
      lib: JAYPIE.LIB.LAMBDA,
    });
    libLogger.trace("[jaypie] WebSocket init");

    const log = (publicLogger as unknown as JaypieLogger).lib({
      level: (publicLogger as unknown as JaypieLogger).level,
      lib: JAYPIE.LIB.LAMBDA,
    });

    //
    //
    // Parse WebSocket Event
    //

    const { requestContext, body, queryStringParameters } = event;
    const { connectionId, domainName, routeKey, stage } = requestContext;

    // Tag with WebSocket-specific info
    (publicLogger as unknown as JaypieLogger).tag({
      connectionId: connectionId.slice(0, 8),
      routeKey,
    });

    // Create send function for this connection
    const send = async (data: unknown): Promise<SendResult> => {
      const result = await sendToConnection({
        connectionId,
        data,
        domainName,
        stage,
      });
      return {
        connectionValid: result.connectionValid,
        success: result.success,
      };
    };

    // Create broadcast function for multiple connections
    const broadcast = async (
      connectionIds: string[],
      data: unknown,
    ): Promise<BroadcastResult> => {
      const result = await broadcastToConnections({
        connectionIds,
        data,
        domainName,
        stage,
      });
      return {
        staleConnections: result.staleConnections,
        successCount: result.successCount,
      };
    };

    // Build WebSocket context
    const wsContext: WebSocketContext = {
      awsRequestId: lambdaContext.awsRequestId,
      body: body ?? null,
      broadcast,
      connectionId,
      domainName,
      queryStringParameters: queryStringParameters ?? null,
      routeKey,
      send,
      stage,
    };

    //
    //
    // Preprocess
    //

    const jaypieFunction = jaypieHandler(
      handler as (...args: unknown[]) => Promise<unknown>,
      {
        chaos,
        name,
        setup,
        teardown,
        unavailable,
        validate,
      },
    );

    let response: TResult;

    try {
      libLogger.trace("[jaypie] WebSocket execution");
      log.info.var({ routeKey, connectionId, body: body?.slice(0, 200) });

      //
      //
      // Process
      //

      response = (await jaypieFunction(event, wsContext, ...args)) as TResult;

      //
      //
      // Error Handling
      //
    } catch (error) {
      // Jaypie or "project" errors are intentional and should be handled like expected cases
      if ((error as JaypieError).isProjectError) {
        log.debug("Caught jaypie error");
        log.info.var({ jaypieError: error });
        // For WebSocket, return error as body with appropriate status code
        const errorBody = (error as JaypieError).body() as {
          errors?: { status?: number }[];
        };
        const statusCode = errorBody?.errors?.[0]?.status ?? 500;
        response = {
          body: JSON.stringify(errorBody),
          statusCode,
        } as TResult;
      } else {
        // Otherwise, flag unhandled errors as fatal
        log.fatal("Caught unhandled error");
        log.info.var({ unhandledError: (error as Error).message });
        response = {
          body: JSON.stringify(new UnhandledError().body()),
          statusCode: 500,
        } as TResult;
      }
      if (shouldThrow) {
        libLogger.debug(
          `Throwing error instead of returning response (throw=${shouldThrow})`,
        );
        throw error;
      }
    }

    //
    //
    // Postprocess
    //

    // Log response
    log.info.var({ response });

    // Clean up the public logger
    (publicLogger as unknown as JaypieLogger).untag("handler");
    (publicLogger as unknown as JaypieLogger).untag("connectionId");
    (publicLogger as unknown as JaypieLogger).untag("routeKey");

    //
    //
    // Return
    //

    return response;
  };
};

//
//
// Export
//

export default websocketHandler;
