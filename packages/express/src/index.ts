// Lambda adapter exports
export {
  createLambdaHandler,
  createLambdaStreamHandler,
  getCurrentInvoke,
  LambdaRequest,
  LambdaResponseBuffered,
  LambdaResponseStreaming,
} from "./adapter/index.js";
export type {
  ApiGatewayV1Event,
  CreateLambdaHandlerOptions,
  FunctionUrlEvent,
  LambdaContext,
  LambdaEvent,
  LambdaHandler,
  LambdaResponse,
  LambdaStreamHandler,
  ResponseStream,
} from "./adapter/index.js";

// Express handler exports
export { EXPRESS } from "./constants.js";
export { default as cors } from "./cors.helper.js";
export type { CorsConfig } from "./cors.helper.js";
export { default as createServer } from "./createServer.js";
export type { CreateServerOptions, ServerResult } from "./createServer.js";
export { default as expressHandler } from "./expressHandler.js";
export type {
  ExpressHandlerLocals,
  ExpressHandlerOptions,
  JaypieHandlerSetup,
  JaypieHandlerTeardown,
  JaypieHandlerValidate,
} from "./expressHandler.js";
export { default as expressHttpCodeHandler } from "./http.handler.js";
export { default as expressStreamHandler } from "./expressStreamHandler.js";
export type {
  ExpressStreamHandler,
  ExpressStreamHandlerLocals,
  ExpressStreamHandlerOptions,
  JaypieStreamHandlerSetup,
  JaypieStreamHandlerTeardown,
  JaypieStreamHandlerValidate,
} from "./expressStreamHandler.js";
export { default as getCurrentInvokeUuid } from "./getCurrentInvokeUuid.adapter.js";
export * from "./routes.js";
