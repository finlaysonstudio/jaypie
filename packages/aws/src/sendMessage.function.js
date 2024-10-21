import {
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

export default async ({
  body,
  delaySeconds = 0,
  messageAttributes,
  messageGroupId = `${PROJECT}-Group-Id`,
  queueUrl,
} = {}) => {
  const log = defaultLogger.lib({ lib: JAYPIE.LIB.AWS });
  log.var({
    sendMessageInit: {
      body,
      queueUrl,
      messageAttributes,
    },
  });

  //
  //
  // Validate
  //

  if (!body) {
    defaultLogger.error("Message body is required");
    throw new ConfigurationError();
  }

  validate.number(delaySeconds);
  validate.object(messageAttributes, { required: false });
  messageGroupId = force.string(messageGroupId);
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
  if (typeof body === "object") {
    command.MessageBody = JSON.stringify(body);
  } else {
    command.MessageBody = String(body);
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
      body: JSON.stringify(body),
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
  const response = await client.send(new SendMessageCommand(command));
  log.trace.var({ sqsSendMessageResponse: response });
  log.var({ queueMessageId: response.MessageId });

  //
  //
  // Return
  //

  return response;
};
