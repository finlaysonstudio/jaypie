import { ConfigurationError } from "@jaypie/errors";
import { log } from "@jaypie/logger";

const validateQueueUrl = (queueUrl: string): boolean => {
  const regex = /https:\/\/sqs\.us-east-1\.amazonaws\.com\/\d{12}\/\w+/g;
  if (!regex.test(queueUrl)) {
    log.error(`Invalid queue url: ${queueUrl}`);
    throw new ConfigurationError();
  }
  return true;
};

export default validateQueueUrl;
