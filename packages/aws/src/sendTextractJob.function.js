import {
  FeatureType,
  StartDocumentAnalysisCommand,
  TextractClient,
} from "@aws-sdk/client-textract";
import { ConfigurationError, JAYPIE, log as defaultLogger } from "@jaypie/core";
import { StandardRetryStrategy } from "@aws-sdk/middleware-retry";

//
//
// Constants
//

const AWS_REGION = "us-east-1";
const MAX_RETRIES = 5; // Increased from default 3
const RETRY_DELAY = 300; // Base delay in ms

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
}) => {
  if (!key || !bucket) {
    throw new ConfigurationError("[sendTextractJob] Missing key or bucket");
  }

  const client = new TextractClient({
    region: AWS_REGION,
    retryStrategy: new StandardRetryStrategy(MAX_RETRIES, (attempt) =>
      Math.min(RETRY_DELAY * 2 ** attempt, 3000),
    ),
  });

  const params = {
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
    return response.JobId;
  } catch (error) {
    if (error.name === "ProvisionedThroughputExceededException") {
      defaultLogger
        .lib({ lib: JAYPIE.LIB.AWS })
        .error(
          `Textract throughput exceeded - retried ${error.$metadata?.attempts} times`,
        );
      defaultLogger.lib({ lib: JAYPIE.LIB.AWS }).var({ error });
    }
    throw error;
  }
};

//
//
// Export
//

export default sendTextractJob;
