declare module "@jaypie/aws" {
  // Message Types
  export interface SQSMessage {
    MessageId: string;
    ReceiptHandle: string;
    Body: string;
    Attributes?: Record<string, unknown>;
    MessageAttributes?: Record<string, unknown>;
    MD5OfBody?: string;
    EventSource?: string;
    EventSourceARN?: string;
    AwsRegion?: string;
  }

  export interface SQSMessageResponse {
    value: string;
  }

  // Function Types
  export function getMessages(
    queueUrl: string,
    options?: {
      maxNumberOfMessages?: number;
      visibilityTimeout?: number;
      waitTimeSeconds?: number;
    }
  ): Promise<SQSMessage[]>;

  export function getSecret(
    secretId: string,
    options?: {
      region?: string;
      versionId?: string;
      versionStage?: string;
    }
  ): Promise<string>;

  export function sendBatchMessages(
    queueUrl: string,
    messages: Array<string | Record<string, unknown>>,
    options?: {
      delaySeconds?: number;
      messageAttributes?: Record<string, unknown>;
    }
  ): Promise<SQSMessageResponse>;

  export function sendMessage(
    queueUrl: string,
    message: string | Record<string, unknown>,
    options?: {
      delaySeconds?: number;
      messageAttributes?: Record<string, unknown>;
    }
  ): Promise<SQSMessageResponse>;
} 