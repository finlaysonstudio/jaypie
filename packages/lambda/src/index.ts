import lambdaHandler from "./lambdaHandler.js";
import lambdaStreamHandler from "./lambdaStreamHandler.js";

//
//
// Export
//

export { lambdaHandler, lambdaStreamHandler };
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

// Re-export StreamFormat from @jaypie/aws for convenience
export type { StreamFormat } from "@jaypie/aws";
