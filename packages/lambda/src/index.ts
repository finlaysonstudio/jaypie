import lambdaHandler from "./lambdaHandler.js";
import lambdaStreamHandler from "./lambdaStreamHandler.js";
import websocketHandler from "./websocketHandler.js";

//
//
// Export
//

export { lambdaHandler, lambdaStreamHandler, websocketHandler };
export type {
  LambdaContext,
  LambdaHandlerFunction,
  LambdaHandlerOptions,
} from "./lambdaHandler.js";
export type {
  AwsStreamingHandler,
  LambdaHandler,
  LambdaStreamContext,
  LambdaStreamHandlerFunction,
  LambdaStreamHandlerOptions,
  RawStreamingHandler,
  ResponseStream,
  StreamHandlerContext,
} from "./lambdaStreamHandler.js";
export type {
  BroadcastResult,
  SendResult,
  WebSocketContext,
  WebSocketEvent,
  WebSocketHandlerFunction,
  WebSocketHandlerOptions,
  WebSocketResponse,
} from "./websocketHandler.js";

// Re-export StreamFormat from @jaypie/aws for convenience
export type { StreamFormat } from "@jaypie/aws";
