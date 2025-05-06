import { createMockFunction } from "./utils";

// Constants for mock values
const TAG = "AWS";

export const getMessages = createMockFunction<
  (queueUrl: string) => Promise<any[]>
>(async () => []);

export const getSecret = createMockFunction<
  (secretName: string) => Promise<string>
>(async () => "mock-secret-value");

export const sendMessage = createMockFunction<
  (queueUrl: string, message: any) => Promise<void>
>(async () => {});

// Add missing functions from original implementation
export const getEnvSecret = createMockFunction<
  (key: string) => Promise<string>
>(async (key) => `_MOCK_ENV_SECRET_[${TAG}][${key}]`);

export const getSingletonMessage = createMockFunction<(event: any) => any>(
  (event) => {
    try {
      // Try original implementation first
      if (event && Array.isArray(event.Records) && event.Records.length === 1) {
        return event.Records[0];
      }
      // Fall back to mock implementation
      return { value: `_MOCK_SINGLETON_MESSAGE_[${TAG}]` };
    } catch (error) {
      return { value: `_MOCK_SINGLETON_MESSAGE_[${TAG}]` };
    }
  },
);

export const getTextractJob = createMockFunction<
  (jobId: string) => Promise<any>
>(async (job) => ({ value: `_MOCK_TEXTRACT_JOB_[${job}]` }));

export const sendBatchMessages = createMockFunction<
  (queueUrl: string, messages: any[]) => Promise<any>
>(async (queueUrl, messages) => ({
  value: `_MOCK_BATCH_MESSAGES_[${TAG}]`,
  count: messages.length,
}));

export const sendTextractJob = createMockFunction<
  (bucket: string, key: string, featureTypes?: string[]) => Promise<any[]>
>(async (bucket, key, featureTypes = []) => {
  // Basic validation to mimic original behavior
  if (!bucket || !key) {
    throw new Error("Bucket and key are required");
  }
  return [`_MOCK_TEXTRACT_JOB_ID_[${TAG}]_${bucket}_${key}`];
});
