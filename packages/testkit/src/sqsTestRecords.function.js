import { v4 as uuid } from "uuid";

//
//
// Main
//

const sqsTestRecords = (...args) => {
  const records = [];

  // See if only a single array was passed in and spread it
  if (args.length === 1 && Array.isArray(args[0])) {
    [args] = args;
  }

  for (let i = 0; i < args.length; i += 1) {
    const item = args[i];
    let body;
    if (item && typeof item === "object") {
      body = JSON.stringify(item);
    } else {
      // Cast item to string
      body = String(item);
    }
    const record = {
      messageId: uuid(),
      body,
    };
    records.push(record);
  }

  return {
    Records: records,
  };
};

//
//
// Export
//

export default sqsTestRecords;
