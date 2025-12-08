import {
  BadGatewayError,
  BadRequestError,
  ConfigurationError,
} from "@jaypie/errors";
import { force, JAYPIE } from "@jaypie/kit";
import { log as defaultLogger } from "@jaypie/logger";

import {
  MessageAttributeValue,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
  SQSClient,
} from "@aws-sdk/client-sqs";
import crypto from "crypto";

import validateQueueUrl from "./validateQueueUrl.util.js";

//
//
// Types
//

interface JaypieLogger {
  trace: {
    var: (data: Record<string, unknown>) => void;
  };
  var: (data: Record<string, unknown>) => void;
  debug: (message: string) => void;
  error: (message: string) => void;
}

interface SendBatchMessagesParams {
  delaySeconds?: number;
  messages?: unknown[];
  messageAttributes?: Record<string, MessageAttributeValue>;
  messageGroupId?: string;
  queueUrl?: string;
}

interface AwsError extends Error {
  name: string;
}

//
//
// Constants
//
const PROJECT = process.env.PROJECT_KEY || "Unknown";

//
//
// Main
//
export default async ({
  delaySeconds = 0,
  messages,
  messageAttributes,
  messageGroupId = `${PROJECT}-Group-Id`,
  queueUrl = process.env.CDK_ENV_QUEUE_URL,
}: SendBatchMessagesParams = {}): Promise<boolean> => {
  const log = defaultLogger.lib({
    lib: JAYPIE.LIB.AWS,
  }) as unknown as JaypieLogger;

  //
  //
  // Validate
  //

  if (!messages) {
    defaultLogger.error("Messages are required");
    throw new ConfigurationError();
  }

  if (typeof delaySeconds !== "number" || Number.isNaN(delaySeconds)) {
    throw new BadRequestError(
      `Argument "${delaySeconds}" doesn't match type "number"`,
    );
  }
  if (
    messageAttributes !== undefined &&
    (typeof messageAttributes !== "object" ||
      messageAttributes === null ||
      Array.isArray(messageAttributes))
  ) {
    throw new BadRequestError(
      `Argument "${messageAttributes}" doesn't match type "object"`,
    );
  }
  const resolvedMessageGroupId = force.string(messageGroupId);
  if (!Array.isArray(messages)) {
    throw new BadRequestError(
      `Argument "${messages}" doesn't match type "array"`,
    );
  }
  if (typeof queueUrl !== "string") {
    throw new BadRequestError(
      `Argument "${queueUrl}" doesn't match type "string"`,
    );
  }
  validateQueueUrl(queueUrl);

  //
  //
  // Setup
  //

  // Group messages by 10 - make a copy to avoid mutating the original
  const messagesCopy = [...messages];
  const messageGroups: unknown[][] = [];
  while (messagesCopy.length) {
    messageGroups.push(messagesCopy.splice(0, 10));
  }

  //
  //
  // Process
  //

  for (let i = 0; i < messageGroups.length; i += 1) {
    const messageGroup = messageGroups[i];
    const entries: SendMessageBatchRequestEntry[] = [];
    for (let j = 0; j < messageGroup.length; j += 1) {
      const message = messageGroup[j];
      const entry: SendMessageBatchRequestEntry = {
        Id: `${i}-${j}`,
        MessageBody: "",
      };

      if (delaySeconds) {
        entry.DelaySeconds = delaySeconds;
      }
      if (messageAttributes) {
        entry.MessageAttributes = messageAttributes;
      }
      if (typeof message === "object") {
        entry.MessageBody = JSON.stringify(message);
      } else {
        entry.MessageBody = String(message);
      }
      if (queueUrl?.endsWith(".fifo")) {
        entry.MessageGroupId = resolvedMessageGroupId;
        entry.MessageDeduplicationId = crypto
          .createHash("md5")
          .update(JSON.stringify(message))
          .digest("hex");
      }
      entries.push(entry);
    }
    const client = new SQSClient();
    const command = {
      Entries: entries,
      QueueUrl: queueUrl,
    };

    try {
      const response = await client.send(new SendMessageBatchCommand(command));
      log.trace.var({ sqsSendMessageResponse: response });
    } catch (error) {
      const awsError = error as AwsError;
      // Handle forbidden/authorization errors differently
      if (
        awsError.name === "AccessDeniedException" ||
        awsError.name === "NotAuthorized" ||
        awsError.name === "MissingAuthenticationToken"
      ) {
        log.error(
          "[@jaypie/aws] Authorization error sending batch messages to SQS",
        );
        log.debug(`Does handler have grantSendMessages on "${queueUrl}"?`);
      } else {
        // Log all other errors (service errors, throttling, network issues etc)
        log.error("[@jaypie/aws] Error sending batch messages to SQS");
      }
      log.debug(JSON.stringify({ error }));
      throw new BadGatewayError();
    }
  }

  //
  //
  // Return
  //

  return true;
};
