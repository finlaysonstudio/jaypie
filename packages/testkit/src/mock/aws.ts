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

export const loadEnvSecrets = createMockResolvedFunction(undefined);

export const getSingletonMessage = createMockWrappedFunction(
  original.getSingletonMessage,
  { value: "_MOCK_SINGLETON_MESSAGE_" },
);

export const getTextractJob = createMockFunction<
  (jobId: string) => Promise<any>
>(async (job) => ({ value: `_MOCK_TEXTRACT_JOB_[${job}]` }));

export const sendBatchMessages = createMockResolvedFunction(true);

export const sendTextractJob = createMockFunction<
  ({
    bucket,
    key,
    featureTypes,
  }: {
    bucket: string;
    key: string;
    featureTypes?: string[];
    snsRoleArn?: string;
    snsTopicArn?: string;
  }) => Promise<any[]>
>(async ({ bucket, key }) => {
  // Basic validation to mimic original behavior
  if (!bucket || !key) {
    throw new Error("Bucket and key are required");
  }
  return [`_MOCK_TEXTRACT_JOB_ID_[${TAG}]_${bucket}_${key}`];
});

// Streaming utilities
export const formatSSE = createMockFunction<
  (chunk: { type: string; [key: string]: unknown }) => string
>((chunk) => `event: ${chunk.type}\ndata: ${JSON.stringify(chunk)}\n\n`);

export const streamToSSE = createMockFunction<
  (stream: AsyncIterable<unknown>) => AsyncIterable<string>
>(async function* (stream) {
  for await (const chunk of stream) {
    yield `event: mock\ndata: ${JSON.stringify(chunk)}\n\n`;
  }
});

export const createLambdaStream = createMockFunction<
  (
    stream: AsyncIterable<unknown>,
    writer: { write: (chunk: string) => void; end: () => void },
  ) => Promise<void>
>(async (stream, writer) => {
  for await (const chunk of stream) {
    writer.write(JSON.stringify(chunk));
  }
  writer.end();
});

export const createExpressStream = createMockFunction<
  (
    stream: AsyncIterable<unknown>,
    res: {
      setHeader: (name: string, value: string) => void;
      write: (chunk: string) => boolean;
      end: () => void;
      flushHeaders: () => void;
    },
  ) => Promise<void>
>(async (stream, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.flushHeaders();
  for await (const chunk of stream) {
    res.write(JSON.stringify(chunk));
  }
  res.end();
});

// Mock JaypieStream class
export class JaypieStream {
  private readonly source: AsyncIterable<unknown>;

  constructor(source: AsyncIterable<unknown>) {
    this.source = source;
  }

  async toLambda(writer: {
    write: (chunk: string) => void;
    end: () => void;
  }): Promise<void> {
    for await (const chunk of this.source) {
      writer.write(JSON.stringify(chunk));
    }
    writer.end();
  }

  async toExpress(res: {
    setHeader: (name: string, value: string) => void;
    write: (chunk: string) => boolean;
    end: () => void;
    flushHeaders: () => void;
  }): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.flushHeaders();
    for await (const chunk of this.source) {
      res.write(JSON.stringify(chunk));
    }
    res.end();
  }

  [Symbol.asyncIterator](): AsyncIterator<unknown> {
    return this.source[Symbol.asyncIterator]();
  }

  toSSE(): AsyncIterable<string> {
    const source = this.source;
    return {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of source) {
          yield `event: mock\ndata: ${JSON.stringify(chunk)}\n\n`;
        }
      },
    };
  }
}

export const createJaypieStream = createMockFunction<
  (source: AsyncIterable<unknown>) => JaypieStream
>((source) => new JaypieStream(source));
