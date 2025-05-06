/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as original from "@jaypie/aws";
import {
  createMockFunction,
  createMockResolvedFunction,
  createMockWrappedFunction,
} from "./utils";

// Constants for mock values
const TAG = "AWS";

export const getMessages = createMockWrappedFunction(original.getMessages, []);

export const getSecret = createMockResolvedFunction("mock-secret-value");

export const sendMessage = createMockResolvedFunction({
  MessageId: "mock-message-id",
});

// Add missing functions from original implementation
export const getEnvSecret = createMockFunction<
  (key: string) => Promise<string>
>(async (key) => `_MOCK_ENV_SECRET_[${TAG}][${key}]`);

export const getSingletonMessage = createMockWrappedFunction(
  original.getSingletonMessage,
  { value: "_MOCK_SINGLETON_MESSAGE_" },
);

export const getTextractJob = createMockFunction<
  (jobId: string) => Promise<any>
>(async (job) => ({ value: `_MOCK_TEXTRACT_JOB_[${job}]` }));

export const sendBatchMessages = createMockResolvedFunction(true);

export const sendTextractJob = createMockFunction<
  (bucket: string, key: string, featureTypes?: string[]) => Promise<any[]>
>(async (bucket, key, featureTypes = []) => {
  // Basic validation to mimic original behavior
  if (!bucket || !key) {
    throw new Error("Bucket and key are required");
  }
  return [`_MOCK_TEXTRACT_JOB_ID_[${TAG}]_${bucket}_${key}`];
});
