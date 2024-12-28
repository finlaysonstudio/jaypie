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
const sqsTestRecords = (...records: Array<unknown>): SQSEvent => {
  // If first argument is an array, use that as records
  const recordsArray = Array.isArray(records[0]) ? records[0] : records;

  // Map records to SQS record format
  const formattedRecords = recordsArray.map((record) => {
    if (typeof record === "object" && record !== null) {
      return {
        ...record,
        body:
          typeof (record as { body?: unknown }).body === "string"
            ? (record as { body: string }).body
            : JSON.stringify((record as { body?: unknown }).body ?? record),
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
