import { loadEnvSecrets } from "@jaypie/aws";

import lambdaHandler from "./lambdaHandler.js";
import lambdaStreamHandler from "./lambdaStreamHandler.js";

//
//
// Export
//

export { lambdaHandler, lambdaStreamHandler, loadEnvSecrets };
export type {
  LambdaContext,
  LambdaHandlerFunction,
  LambdaHandlerOptions,
} from "./lambdaHandler.js";
export type {
  AwsStreamingHandler,
  LambdaStreamContext,
  LambdaStreamHandlerFunction,
  LambdaStreamHandlerOptions,
  ResponseStream,
  StreamHandlerContext,
} from "./lambdaStreamHandler.js";
