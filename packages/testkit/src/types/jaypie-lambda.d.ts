declare module "@jaypie/lambda" {
  // Types
  export interface LambdaContext {
    awsRequestId?: string;
    callbackWaitsForEmptyEventLoop?: boolean;
    clientContext?: unknown;
    functionName?: string;
    functionVersion?: string;
    identity?: unknown;
    invokedFunctionArn?: string;
    logGroupName?: string;
    logStreamName?: string;
    memoryLimitInMB?: string;
    [key: string]: unknown;
  }

  export type LambdaHandler<TEvent = unknown, TResult = unknown> = (
    event: TEvent,
    context: LambdaContext,
    ...args: unknown[]
  ) => Promise<TResult>;

  export interface LambdaHandlerOptions {
    setup?: Array<
      (
        event: unknown,
        context: LambdaContext,
        ...args: unknown[]
      ) => Promise<void>
    >;
    teardown?: Array<
      (
        event: unknown,
        context: LambdaContext,
        ...args: unknown[]
      ) => Promise<void>
    >;
    unavailable?: boolean;
    validate?: Array<
      (
        event: unknown,
        context: LambdaContext,
        ...args: unknown[]
      ) => Promise<boolean>
    >;
  }

  // Main Function
  export function lambdaHandler<TEvent = unknown, TResult = unknown>(
    handlerOrOptions: LambdaHandler<TEvent, TResult> | LambdaHandlerOptions,
    optionsOrHandler?: LambdaHandlerOptions | LambdaHandler<TEvent, TResult>,
  ): LambdaHandler<TEvent, TResult>;
}
