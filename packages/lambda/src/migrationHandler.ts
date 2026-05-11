import lambdaHandler, {
  LambdaContext,
  LambdaHandlerFunction,
  LambdaHandlerOptions,
} from "./lambdaHandler.js";

type MigrationResult<T = unknown> = T & { pending?: boolean };

// Defaults to throw: true so a failed migration fails the CFN custom resource
// (and therefore the deploy) instead of being swallowed and reported COMPLETE.
//
// When cr.Provider uses the same Lambda for both onEventHandler and isCompleteHandler,
// the event shape differs: isCompleteHandler receives a top-level Data field (from
// onEventHandler's response); onEventHandler does not. We use this to branch:
//
// - onEventHandler mode: return PhysicalResourceId immediately (migration runs later).
// - isCompleteHandler mode: run migration; map pending → IsComplete for CFN waiter.
const migrationHandler = function <TEvent = unknown, TResult = unknown>(
  handler:
    | LambdaHandlerFunction<TEvent, MigrationResult<TResult>>
    | LambdaHandlerOptions,
  options:
    | LambdaHandlerOptions
    | LambdaHandlerFunction<TEvent, MigrationResult<TResult>> = {},
): LambdaHandlerFunction<TEvent, unknown> {
  if (typeof handler === "object" && typeof options === "function") {
    const temp = handler;
    handler = options;
    options = temp;
  }

  const opts = options as LambdaHandlerOptions;
  const innerHandler = lambdaHandler<TEvent, MigrationResult<TResult>>(
    handler as LambdaHandlerFunction<TEvent, MigrationResult<TResult>>,
    { throw: true, ...opts },
  );

  return async (
    event: TEvent = {} as TEvent,
    context: LambdaContext = {},
  ): Promise<unknown> => {
    const cfnEvent = event as Record<string, unknown>;

    // isCompleteHandler: CDK cr.Provider passes the Data from onEventHandler in event.
    // Run the migration and map the pending flag to CFN's IsComplete protocol.
    if (cfnEvent !== null && typeof cfnEvent === "object" && "Data" in cfnEvent) {
      const result = await innerHandler(event, context);
      const pending =
        result !== null &&
        typeof result === "object" &&
        Boolean((result as MigrationResult<unknown>).pending);
      return { Data: result, IsComplete: !pending };
    }

    // onEventHandler: return PhysicalResourceId immediately; the migration runs
    // in subsequent isCompleteHandler invocations via the Step Functions waiter.
    return {
      PhysicalResourceId:
        (cfnEvent?.PhysicalResourceId as string | undefined) ?? "migration",
    };
  };
};

export default migrationHandler;
