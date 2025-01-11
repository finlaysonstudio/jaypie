import {
  FeatureType,
  StartDocumentAnalysisCommand,
  TextractClient,
} from "@aws-sdk/client-textract";
import { ConfigurationError } from "@jaypie/core";

//
//
// Constants
//

const AWS_REGION = "us-east-1";

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
  bucket,
  featureTypes = DEFAULT_FEATURE_TYPES,
  snsRoleArn,
  snsTopicArn,
}) => {
  if (!key || !bucket) {
    throw new ConfigurationError("[sendTextractJob] Missing key or bucket");
  }

  const client = new TextractClient({ region: AWS_REGION });

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

  const command = new StartDocumentAnalysisCommand(params);
  const response = await client.send(command);

  return response.JobId;
};

//
//
// Export
//

export default sendTextractJob;
