import StatsD from "hot-shots";
import { log } from "@jaypie/core";

let statsdClient = null;

const getStatsDClient = () => {
  if (statsdClient) {
    return statsdClient;
  }

  const {
    DD_ENV,
    DD_SERVICE,
    DD_VERSION,
    PROJECT_ENV,
    PROJECT_SERVICE,
    PROJECT_VERSION,
  } = process.env;

  const globalTags = [];
  if (DD_ENV || PROJECT_ENV) {
    globalTags.push(`env:${DD_ENV || PROJECT_ENV}`);
  }
  if (DD_SERVICE || PROJECT_SERVICE) {
    globalTags.push(`service:${DD_SERVICE || PROJECT_SERVICE}`);
  }
  if (DD_VERSION || PROJECT_VERSION) {
    globalTags.push(`version:${DD_VERSION || PROJECT_VERSION}`);
  }

  statsdClient = new StatsD({
    host: "localhost",
    port: 8125,
    protocol: "udp",
    globalTags,
    errorHandler: (error) => {
      log.error.var({ statsdError: error.message });
    },
  });

  return statsdClient;
};

export const isLambdaWithExtension = () => {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.DD_API_KEY_SECRET_ARN
  );
};

export default getStatsDClient;
