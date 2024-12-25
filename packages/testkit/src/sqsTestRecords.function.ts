interface SQSRecord {
  body: string;
  messageId?: string | number;
  [key: string]: unknown;
}

interface SQSEvent {
  Records: Array<{
    body: string;
    messageId?: string | number;
    [key: string]: unknown;
  }>;
}

/**
 * Creates a mock SQS event with the given records
 * @param records - Array of records or individual records to include in the event
 * @returns SQS event object with Records array
 */
const sqsTestRecords = (...records: Array<SQSRecord | string | number | boolean | null | undefined>): SQSEvent => {
  // If first argument is an array, use that as records
  const recordsArray = Array.isArray(records[0]) ? records[0] : records;

  // Map records to SQS record format
  const formattedRecords = recordsArray.map((record) => {
    if (typeof record === "object" && record !== null) {
      return {
        ...record,
        body: typeof record.body === "string" 
          ? record.body 
          : JSON.stringify(record.body ?? record),
      };
    }
    return {
      body: String(record),
    };
  });

  return {
    Records: formattedRecords,
  };
};

export default sqsTestRecords; 