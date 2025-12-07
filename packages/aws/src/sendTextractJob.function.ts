import {
  FeatureType,
  StartDocumentAnalysisCommand,
  StartDocumentAnalysisCommandInput,
  TextractClient,
} from "@aws-sdk/client-textract";
import {
  ConfigurationError,
  JAYPIE,
  log as defaultLogger,
  sleep,
} from "@jaypie/core";
import { StandardRetryStrategy } from "@aws-sdk/middleware-retry";

//
//
// Types
//

interface JaypieLogger {
  var: (data: Record<string, unknown>) => void;
  error: (message: string) => void;
}

interface SendTextractJobParams {
  key: string;
  bucket?: string;
  featureTypes?: FeatureType[];
  snsRoleArn?: string;
  snsTopicArn?: string;
  throttle?: boolean;
}

interface TextractError extends Error {
  name: string;
  $metadata?: {
    attempts?: number;
  };
}

//
//
// Constants
//

const AWS_REGION = "us-east-1";
const MAX_RETRIES = 5; // Increased from default 3
const RETRY_DELAY = 600; // 100 requests per minute

const DEFAULT_FEATURE_TYPES = [
  FeatureType.FORMS,
  FeatureType.LAYOUT,
  FeatureType.SIGNATURES,
  FeatureType.TABLES,
];

//
//
// Main
//

const sendTextractJob = async ({
  key,
  bucket = process.env.CDK_ENV_BUCKET,
  featureTypes = DEFAULT_FEATURE_TYPES,
  snsRoleArn = process.env.CDK_ENV_SNS_ROLE_ARN,
  snsTopicArn = process.env.CDK_ENV_SNS_TOPIC_ARN,
  throttle = true,
}: SendTextractJobParams): Promise<string | undefined> => {
  if (!key || !bucket) {
    throw new ConfigurationError("[sendTextractJob] Missing key or bucket");
  }

  const client = new TextractClient({
    region: AWS_REGION,
    retryStrategy: new StandardRetryStrategy(async () => MAX_RETRIES, {
      delayDecider: (_, attempt) => Math.min(RETRY_DELAY * 2 ** attempt, 3000),
    }),
  });

  const params: StartDocumentAnalysisCommandInput = {
    DocumentLocation: {
      S3Object: {
        Name: key,
        Bucket: bucket,
      },
    },
    FeatureTypes: featureTypes,
  };

  if (snsRoleArn && snsTopicArn) {
    params.NotificationChannel = {
      RoleArn: snsRoleArn,
      SNSTopicArn: snsTopicArn,
    };
  }

  try {
    const command = new StartDocumentAnalysisCommand(params);
    const response = await client.send(command);

    if (throttle) {
      await sleep(RETRY_DELAY);
    }

    return response.JobId;
  } catch (error) {
    const textractError = error as TextractError;
    if (textractError.name === "ProvisionedThroughputExceededException") {
      (
        defaultLogger.lib({ lib: JAYPIE.LIB.AWS }) as unknown as JaypieLogger
      ).error(
        `Textract throughput exceeded - retried ${textractError.$metadata?.attempts} times`,
      );
      (
        defaultLogger.lib({ lib: JAYPIE.LIB.AWS }) as unknown as JaypieLogger
      ).var({ error });
    }
    throw error;
  }
};

//
//
// Export
//

export default sendTextractJob;
