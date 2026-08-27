import lambdaHandler, {
  LambdaContext,
  LambdaHandlerFunction,
  LambdaHandlerOptions,
} from "./lambdaHandler.js";

type MigrationResult<T = unknown> = T & { pending?: boolean };

const MIGRATION_PHYSICAL_RESOURCE_ID = "migration";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

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
    const cfnEvent: Record<string, unknown> = isPlainObject(event) ? event : {};
    const physicalResourceId =
      (cfnEvent.PhysicalResourceId as string | undefined) ??
      MIGRATION_PHYSICAL_RESOURCE_ID;
    const isComplete = "Data" in cfnEvent;

    // Delete: never run migrations. The resource being migrated is usually
    // torn down in the same operation, so the work is wasted at best and, when
    // it fails, strands the stack in ROLLBACK_FAILED (issue #510).
    if (cfnEvent.RequestType === "Delete") {
      return isComplete
        ? { IsComplete: true }
        : {
            Data: { __migration: true },
            PhysicalResourceId: physicalResourceId,
          };
    }

    // isCompleteHandler: CDK cr.Provider passes the Data from onEventHandler in event.
    // Run the migration and map the pending flag to CFN's IsComplete protocol.
    if (isComplete) {
      const result = await innerHandler(event, context);
      const pending =
        isPlainObject(result) &&
        Boolean((result as MigrationResult<unknown>).pending);

      // The cr.Provider framework throws
      // `"Data" is not allowed if "IsComplete" is "False"` when a pending poll
      // carries any Data keys, so pending responses are IsComplete only.
      if (pending) {
        return { IsComplete: false };
      }

      // CloudFormation only accepts a Data map; a scalar or array result would
      // be rejected on submit, so it is reported as complete without Data.
      return isPlainObject(result)
        ? { Data: result, IsComplete: true }
        : { IsComplete: true };
    }

    // onEventHandler: return PhysicalResourceId and a Data marker immediately.
    // cr.Provider only propagates Data to isComplete events when onEvent returned it,
    // so we must include Data here or the "Data" in cfnEvent discriminator will never
    // be true on isComplete polls.
    return {
      Data: { __migration: true },
      PhysicalResourceId: physicalResourceId,
    };
  };
};

export default migrationHandler;
