// @jaypie/fabric/lambda
// Lambda adapter utilities

export { createLambdaService } from "./createLambdaService.js";

export type {
  CreateLambdaServiceConfig,
  CreateLambdaServiceOptions,
  CreateLambdaServiceResult,
  LambdaContext,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "./types.js";
