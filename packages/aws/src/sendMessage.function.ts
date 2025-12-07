import {
  BadGatewayError,
  ConfigurationError,
  force,
  JAYPIE,
  log as defaultLogger,
  validate,
} from "@jaypie/core";

import {
  MessageAttributeValue,
  SendMessageCommand,
  SendMessageCommandInput,
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

interface SendMessageParams {
  body?: unknown;
  delaySeconds?: number;
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

export default async function sendMessage(
  bodyOrParams: unknown | SendMessageParams,
  maybeParams?: SendMessageParams,
) {
  let params: SendMessageParams;
  let messageBody: unknown;

  // Handle both parameter styles
  if (maybeParams === undefined) {
    // params = bodyOrParams || {};
    // If params does not have a body property, use the bodyOrParams as the body
    if (
      !bodyOrParams ||
      typeof bodyOrParams !== "object" ||
      !("body" in bodyOrParams)
    ) {
      messageBody = bodyOrParams;
      params = {};
    } else {
      messageBody = (bodyOrParams as SendMessageParams).body;
      params = bodyOrParams as SendMessageParams;
    }
  } else {
    messageBody = bodyOrParams;
    params = maybeParams || {};
  }

  const {
    delaySeconds = 0,
    messageAttributes,
    messageGroupId: msgGroupId = `${PROJECT}-Group-Id`,
    queueUrl = process.env.CDK_ENV_QUEUE_URL,
  } = params;

  const log = defaultLogger.lib({
    lib: JAYPIE.LIB.AWS,
  }) as unknown as JaypieLogger;
  log.var({
    sendMessageInit: {
      body: messageBody,
      queueUrl,
      messageAttributes,
    },
  });

  //
  //
  // Validate
  //

  if (!messageBody) {
    defaultLogger.error("Message body is required");
    throw new ConfigurationError();
  }

  validate.number(delaySeconds);
  validate.object(messageAttributes, { required: false });
  const messageGroupId = force.string(msgGroupId);
  validate.string(queueUrl);
  validateQueueUrl(queueUrl as string);

  //
  //
  // Setup
  //

  const command: SendMessageCommandInput = {
    QueueUrl: queueUrl,
    MessageBody: "",
  };
  if (messageAttributes) {
    command.MessageAttributes = messageAttributes;
  }
  if (typeof messageBody === "object") {
    command.MessageBody = JSON.stringify(messageBody);
  } else {
    command.MessageBody = String(messageBody);
  }
  if (delaySeconds) {
    command.DelaySeconds = delaySeconds;
  }

  const isFifo = queueUrl?.endsWith(".fifo");
  if (isFifo) {
    // FIFO requires group id
    command.MessageGroupId = messageGroupId;
    // FIFO requires deduplication
    const messageDeduplicationJson = {
      body: JSON.stringify(messageBody),
      messageAttributes: JSON.stringify(messageAttributes),
      queueUrl,
    };
    command.MessageDeduplicationId = crypto
      .createHash("sha256")
      .update(JSON.stringify(messageDeduplicationJson))
      .digest("hex"); // 'hex' encoding gives a nice string format
  }

  //
  //
  // Process
  //

  const client = new SQSClient();
  log.var({ sentToQueue: command });

  try {
    const response = await client.send(new SendMessageCommand(command));
    log.trace.var({ sqsSendMessageResponse: response });
    log.var({ queueMessageId: response.MessageId });
    return response;
  } catch (error) {
    const awsError = error as AwsError;
    // Handle forbidden/authorization errors differently
    if (
      awsError.name === "AccessDeniedException" ||
      awsError.name === "NotAuthorized" ||
      awsError.name === "MissingAuthenticationToken"
    ) {
      log.error("[@jaypie/aws] Authorization error sending message to SQS");
      log.debug(`Does handler have grantSendMessages on "${queueUrl}"?`);
    } else {
      // Log all other errors (service errors, throttling, network issues etc)
      log.error("[@jaypie/aws] Error sending message to SQS");
    }
    log.debug(JSON.stringify({ error }));
    throw new BadGatewayError();
  }

  //
  //
  // Return
  //
}
