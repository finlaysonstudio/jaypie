import {
  BadGatewayError,
  ConfigurationError,
  force,
  JAYPIE,
  log as defaultLogger,
  validate,
} from "@jaypie/core";

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import crypto from "crypto";

import validateQueueUrl from "./validateQueueUrl.util.js";

//
//
// Constants
//

const PROJECT = process.env.PROJECT_KEY || "Unknown";

//
//
// Main
//

export default async function sendMessage(bodyOrParams, maybeParams) {
  let params;
  let messageBody;

  // Handle both parameter styles
  if (maybeParams === undefined) {
    // params = bodyOrParams || {};
    // If params does not have a body property, use the bodyOrParams as the body
    if (!bodyOrParams.body) {
      messageBody = bodyOrParams;
      params = {};
    } else {
      messageBody = bodyOrParams.body;
      params = bodyOrParams;
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

  const log = defaultLogger.lib({ lib: JAYPIE.LIB.AWS });
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
  validateQueueUrl(queueUrl);

  //
  //
  // Setup
  //

  const command = {
    QueueUrl: queueUrl,
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

  const isFifo = queueUrl.endsWith(".fifo");
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
    // Handle forbidden/authorization errors differently
    if (
      error.name === "AccessDeniedException" ||
      error.name === "NotAuthorized" ||
      error.name === "MissingAuthenticationToken"
    ) {
      log.error("[@jaypie/aws] Authorization error sending message to SQS");
      log.debug(`Does handler have grantSendMessages on "${queueUrl}"?`);
    } else {
      // Log all other errors (service errors, throttling, network issues etc)
      log.error("[@jaypie/aws] Error sending message to SQS");
    }
    log.debug({ error });
    throw new BadGatewayError();
  }

  //
  //
  // Return
  //
}
