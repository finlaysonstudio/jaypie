// @jaypie/vocabulary/lambda
// Lambda adapter utilities

export { lambdaServiceHandler } from "./lambdaServiceHandler.js";

export type {
  LambdaContext,
  LambdaServiceHandlerConfig,
  LambdaServiceHandlerOptions,
  LambdaServiceHandlerResult,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "./types.js";
