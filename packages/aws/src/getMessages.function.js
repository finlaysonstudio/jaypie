//
//
// Main
//

export default (event) => {
  const messages = [];

  if (!event || typeof event !== "object") {
    return messages;
  }

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
  }

  return messages;
};
