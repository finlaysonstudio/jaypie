import { createMockFunction } from "./utils";

export const createHandler = createMockFunction<
  (handler: Function) => Function
>((handler) => handler);

export const mockLambdaContext = () => ({
  functionName: "mock-function",
  awsRequestId: "mock-request-id",
  logGroupName: "mock-log-group",
  logStreamName: "mock-log-stream",
  getRemainingTimeInMillis: createMockFunction<() => number>(() => 30000),
  done: createMockFunction(),
  fail: createMockFunction(),
  succeed: createMockFunction(),
});
