import {
  BadGatewayError,
  ConfigurationError,
  force,
  JAYPIE,
  log as defaultLogger,
  validate,
} from "@jaypie/core";

import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
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
  delaySeconds = 0,
  messages,
  messageAttributes,
  messageGroupId = `${PROJECT}-Group-Id`,
  queueUrl,
} = {}) => {
  const log = defaultLogger.lib({ lib: JAYPIE.LIB.AWS });

  //
  //
  // Validate
  //

  if (!messages) {
    defaultLogger.error("Messages are required");
    throw new ConfigurationError();
  }

  validate.number(delaySeconds);
  validate.object(messageAttributes, { required: false });
  messageGroupId = force.string(messageGroupId);
  validate.array(messages);
  validate.string(queueUrl);
  validateQueueUrl(queueUrl);

  //
  //
  // Setup
  //

  // Group messages by 10
  const messageGroups = [];
  while (messages.length) {
    messageGroups.push(messages.splice(0, 10));
  }

  //
  //
  // Process
  //

  for (let i = 0; i < messageGroups.length; i += 1) {
    const messageGroup = messageGroups[i];
    const entries = [];
    for (let j = 0; j < messageGroup.length; j += 1) {
      const message = messageGroup[j];
      const entry = {
        Id: `${i}-${j}`,
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
      if (queueUrl.endsWith(".fifo")) {
        entry.MessageGroupId = messageGroupId;
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
      // Handle forbidden/authorization errors differently
      if (error.name === "AccessDeniedException"
        || error.name === "NotAuthorized"
        || error.name === "MissingAuthenticationToken") {
        log.error("[@jaypie/aws] Authorization error sending batch messages to SQS");
        log.debug(`Does handler have grantSendMessages on "${queueUrl}"?`);
      } else {
        // Log all other errors (service errors, throttling, network issues etc)
        log.error("[@jaypie/aws] Error sending batch messages to SQS");
      }
      log.debug({ error });
      throw new BadGatewayError();
    }
  }

  //
  //
  // Return
  //

  return true;
};
