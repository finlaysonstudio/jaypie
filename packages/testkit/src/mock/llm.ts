import { createMockFunction } from "./utils";

export const getCompletion = createMockFunction<
  (prompt: string, options?: any) => Promise<string>
>(async () => "This is a mock completion response");

export const getCompletionStream = createMockFunction<
  (prompt: string, options?: any) => AsyncIterable<any>
>(async function* () {
  yield { content: "This " };
  yield { content: "is " };
  yield { content: "a " };
  yield { content: "mock " };
  yield { content: "streaming " };
  yield { content: "response" };
});

export const operate = createMockFunction<
  (question: string, context: any, options?: any) => Promise<any>
>(async () => ({ result: "mock operation result" }));
