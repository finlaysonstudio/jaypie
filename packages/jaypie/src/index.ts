//
//
// Export
//

// Errors - from @jaypie/errors
export * from "@jaypie/errors";
export { jaypieErrorFromStatus as errorFromStatusCode } from "@jaypie/errors";

// Backwards compatibility aliases for errors
export { InternalError as ProjectError } from "@jaypie/errors";
export { InternalError as MultiError } from "@jaypie/errors";
export { InternalError as ProjectMultiError } from "@jaypie/errors";

// ERROR constant
export { ERROR } from "./error.constant.js";

// Kit exports
export * from "@jaypie/kit";

// Logger
export { log } from "@jaypie/logger";

// AWS
export * from "@jaypie/aws";

// Datadog
export * from "@jaypie/datadog";

// Express
export * from "@jaypie/express";

// Lambda - explicitly export to avoid type conflicts with @jaypie/express
export { lambdaHandler, lambdaStreamHandler } from "@jaypie/lambda";
export type {
  AwsStreamingHandler,
  LambdaHandlerFunction,
  LambdaHandlerOptions,
  LambdaStreamContext,
  LambdaStreamHandlerFunction,
  LambdaStreamHandlerOptions,
  StreamHandlerContext,
} from "@jaypie/lambda";
// Note: LambdaContext, LambdaHandler, ResponseStream exported from @jaypie/express
// Note: StreamFormat exported from @jaypie/aws
