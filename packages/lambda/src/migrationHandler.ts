import lambdaHandler, {
  LambdaHandlerFunction,
  LambdaHandlerOptions,
} from "./lambdaHandler.js";

// Defaults to throw: true so a failed migration fails the CFN custom resource
// (and therefore the deploy) instead of being swallowed and reported COMPLETE.
const migrationHandler = function <TEvent = unknown, TResult = unknown>(
  handler: LambdaHandlerFunction<TEvent, TResult> | LambdaHandlerOptions,
  options: LambdaHandlerOptions | LambdaHandlerFunction<TEvent, TResult> = {},
): LambdaHandlerFunction<TEvent, TResult> {
  if (typeof handler === "object" && typeof options === "function") {
    const temp = handler;
    handler = options;
    options = temp;
  }

  const opts = options as LambdaHandlerOptions;
  return lambdaHandler<TEvent, TResult>(
    handler as LambdaHandlerFunction<TEvent, TResult>,
    { throw: true, ...opts },
  );
};

export default migrationHandler;
