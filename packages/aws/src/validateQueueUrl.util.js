import { ConfigurationError, log } from "@jaypie/core";

export default (queueUrl) => {
  const regex = /https:\/\/sqs\.us-east-1\.amazonaws\.com\/\d{12}\/\w+/g;
  if (!regex.test(queueUrl)) {
    log.error(`Invalid queue url: ${queueUrl}`);
    throw new ConfigurationError();
  }
  return true;
};
