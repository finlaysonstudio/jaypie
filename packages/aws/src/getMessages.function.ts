import { ConfigurationError } from "@jaypie/core";

//
//
// Types
//

interface SqsRecord {
  body?: string;
  [key: string]: unknown;
}

interface SnsRecord {
  EventSource?: string;
  Sns?: {
    Message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

type EventRecord = SqsRecord | SnsRecord;

interface SqsEvent {
  Records?: EventRecord[];
  [key: string]: unknown;
}

//
//
// Helpers
//

const parseMessageBody = (body: string): unknown => {
  try {
    return JSON.parse(body);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return body;
  }
};

//
//
// Main
//

const getMessages = (event?: SqsEvent | EventRecord[] | unknown): unknown[] => {
  const messages: unknown[] = [];

  if (event === undefined) {
    return messages;
  }

  // Throw ConfigurationError if event is not an object
  if (!event || typeof event !== "object") {
    throw new ConfigurationError("Event must be an object");
  }

  // Handle SQS and SNS events
  if ("Records" in event && Array.isArray(event.Records)) {
    event.Records.forEach((record: EventRecord) => {
      // Handle SNS events
      const snsRecord = record as SnsRecord;
      if (snsRecord.EventSource === "aws:sns" && snsRecord.Sns?.Message) {
        const message = parseMessageBody(snsRecord.Sns.Message);
        if (message) {
          messages.push(message);
        }
        // Handle SQS events
      } else {
        const sqsRecord = record as SqsRecord;
        if (sqsRecord.body) {
          const message = parseMessageBody(sqsRecord.body);
          if (message) {
            messages.push(message);
          }
        }
      }
    });
    // Handle array of events
  } else if (Array.isArray(event)) {
    event.forEach((record: unknown) => {
      if (
        record &&
        typeof record === "object" &&
        "body" in record &&
        (record as SqsRecord).body
      ) {
        const message = parseMessageBody((record as SqsRecord).body as string);
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

export default getMessages;
