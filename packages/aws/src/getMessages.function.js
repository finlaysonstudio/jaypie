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

  // Handle SQS events
  if (Array.isArray(event.Records)) {
    event.Records.forEach((record) => {
      if (record && record.body) {
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
    const message = parseMessageBody(event.body);
    if (message) {
      messages.push(message);
    }
  }

  return messages;
};
