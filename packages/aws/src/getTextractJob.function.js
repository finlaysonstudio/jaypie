import {
  GetDocumentAnalysisCommand,
  JobStatus,
  TextractClient,
} from "@aws-sdk/client-textract";
import { BadGatewayError, JAYPIE, log as jaypieLog } from "jaypie";

//
//
// Constants
//

const AWS_REGION = "us-east-1";

const MAX_RESULTS = 1000; // default and max = 1000

//
//
// Helper Functions
//

//
//
// Main
//

const getTextractJob = async (job) => {
  let doneFetching = false;
  let jobStatus;
  let nextToken;

  const client = new TextractClient({ region: AWS_REGION });
  const log = jaypieLog.lib({ lib: JAYPIE.LIB.AWS });
  const responses = [];

  while (!doneFetching) {
    const params = {
      JobId: job,
      MaxResults: MAX_RESULTS,
      NextToken: nextToken,
    };
    const command = new GetDocumentAnalysisCommand(params);

    const response = await client.send(command);

    if (!response) {
      throw new BadGatewayError("No response from Textract");
    }

    jobStatus = response.JobStatus;
    switch (jobStatus) {
      case JobStatus.IN_PROGRESS:
        log.var({ jobStatus });
        doneFetching = true;
        break;
      case JobStatus.FAILED:
        log.var({ jobStatus });
        doneFetching = true;
        break;
      case JobStatus.PARTIAL_SUCCESS:
        log.var({ jobStatus });
        responses.push(response);
        break;
      case JobStatus.SUCCEEDED:
        responses.push(response);
        break;
      default:
        log.warn(`Unknown job status "${jobStatus}"`);
        log.var({ jobStatus });
        doneFetching = true;
        break;
    }

    // If there is no NextToken, we are done
    doneFetching = !response.NextToken;
    nextToken = response.NextToken;
  }

  return responses;
};

//
//
// Export
//

export default getTextractJob;
