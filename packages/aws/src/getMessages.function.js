//
//
// Main
//

export default (event) => {
  const messages = [];

  if (!event || typeof event !== "object") {
    return messages;
  }

  // Handle SQS events
  if (Array.isArray(event.Records)) {
    event.Records.forEach((record) => {
      if (record && record.body) {
        let message;
        try {
          message = JSON.parse(record.body);
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
          message = record.body;
        }
        if (message) {
          messages.push(message);
        }
      }
    });
  // Handle EventBridge events
  } else if (Array.isArray(event)) {
    event.forEach((record) => {
      if (record && record.body) {
        let message;
        try {
          message = JSON.parse(record.body);
          // eslint-disable-next-line no-unused-vars
        } catch (error) {
          message = record.body;
        }
        if (message) {
          messages.push(message);
        }
      }
    });
  }

  return messages;
};
