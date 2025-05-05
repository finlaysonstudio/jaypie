import { createMockFunction } from "./utils";

export const getMessages = createMockFunction<
  (queueUrl: string) => Promise<any[]>
>(async () => []);

export const getSecret = createMockFunction<
  (secretName: string) => Promise<string>
>(async () => "mock-secret-value");

export const sendMessage = createMockFunction<
  (queueUrl: string, message: any) => Promise<void>
>(async () => {});

export const uploadToS3 = createMockFunction<
  (bucket: string, key: string, data: any) => Promise<string>
>(async () => "https://mock-s3-url.com");

export const downloadFromS3 = createMockFunction<
  (bucket: string, key: string) => Promise<Buffer>
>(async () => Buffer.from("mock-data"));
