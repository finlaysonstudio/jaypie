declare module "@jaypie/aws" {
  import { FeatureType } from "@aws-sdk/client-textract";
  import { MessageAttributeValue } from "@aws-sdk/client-sqs";

  interface TextractJobOptions {
    key: string;
    bucket: string;
    featureTypes?: FeatureType[];
    snsRoleArn?: string;
    snsTopicArn?: string;
  }

  interface SendMessageOptions {
    body: unknown;
    delaySeconds?: number;
    messageAttributes?: Record<string, MessageAttributeValue>;
    messageGroupId?: string;
    queueUrl: string;
  }

  interface SendBatchMessagesOptions {
    delaySeconds?: number;
    messages: unknown[];
    messageAttributes?: Record<string, MessageAttributeValue>;
    messageGroupId?: string;
    queueUrl: string;
  }

  interface GetEnvSecretOptions {
    env?: Record<string, string>;
  }

  export function getEnvSecret(
    name: string,
    options?: GetEnvSecretOptions,
  ): Promise<string | undefined>;
  export function getMessages(event: unknown): unknown[];
  export function getSecret(name: string): Promise<string>;
  export function getSingletonMessage(event: unknown): unknown;
  export function getTextractJob(jobId: string): Promise<unknown[]>;
  export function sendBatchMessages(
    options: SendBatchMessagesOptions,
  ): Promise<boolean>;
  export function sendMessage(options: SendMessageOptions): Promise<unknown>;
  export function sendTextractJob(options: TextractJobOptions): Promise<string>;
}
