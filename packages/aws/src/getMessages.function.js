import { ConfigurationError } from "jaypie";

//
//
// Helpers
//

const parseMessageBody = (body) => {
  try {
    return JSON.parse(body);
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return body;
  }
};

//
//
// Main
//

export default (event) => {
  const messages = [];

  if (event === undefined) {
    return messages;
  }

  // Throw ConfigurationError if event is not an object
  if (!event || typeof event !== "object") {
    throw new ConfigurationError("Event must be an object");
  }

  // Handle SQS and SNS events
  if (Array.isArray(event.Records)) {
    event.Records.forEach((record) => {
      // Handle SNS events
      if (record.EventSource === "aws:sns" && record.Sns?.Message) {
        const message = parseMessageBody(record.Sns.Message);
        if (message) {
          messages.push(message);
        }
        // Handle SQS events
      } else if (record && record.body) {
        const message = parseMessageBody(record.body);
        if (message) {
          messages.push(message);
        }
      }
    });
    // Handle array of events
  } else if (Array.isArray(event)) {
    event.forEach((record) => {
      if (record && record.body) {
        const message = parseMessageBody(record.body);
        if (message) {
          messages.push(message);
        }
      }
    });
    // Handle single object event
  } else {
    messages.push(event);
  }

  return messages;
};
