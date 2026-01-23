/**
 * AWS Suite - Unified AWS CLI access
 */
import { fabricService } from "@jaypie/fabric";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  describeDynamoDBTable,
  describeStack,
  filterLogEvents,
  getDynamoDBItem,
  getLambdaFunction,
  getSQSQueueAttributes,
  listAwsProfiles,
  listLambdaFunctions,
  listS3Objects,
  listSQSQueues,
  listStepFunctionExecutions,
  purgeSQSQueue,
  queryDynamoDB,
  receiveSQSMessage,
  scanDynamoDB,
  stopStepFunctionExecution,
} from "./aws.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Silent logger for direct execution
const log = {
  error: () => {},
  info: () => {},
};

async function getHelp(): Promise<string> {
  return fs.readFile(path.join(__dirname, "help.md"), "utf-8");
}

// Input type for the unified AWS service
interface AwsInput {
  bucket?: string;
  cause?: string;
  command?: string;
  endTime?: string;
  executionArn?: string;
  expressionAttributeValues?: string;
  filterExpression?: string;
  filterPattern?: string;
  functionName?: string;
  functionNamePrefix?: string;
  indexName?: string;
  key?: string;
  keyConditionExpression?: string;
  limit?: number;
  logGroupName?: string;
  maxNumberOfMessages?: number;
  maxResults?: number;
  prefix?: string;
  profile?: string;
  queueNamePrefix?: string;
  queueUrl?: string;
  region?: string;
  scanIndexForward?: boolean;
  stackName?: string;
  startTime?: string;
  stateMachineArn?: string;
  statusFilter?:
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "TIMED_OUT"
    | "ABORTED"
    | "PENDING_REDRIVE";
  tableName?: string;
  visibilityTimeout?: number;
}

export const awsService = fabricService({
  alias: "aws",
  description:
    "Access AWS services via CLI. Commands: list_profiles, lambda_*, stepfunctions_*, logs_*, s3_*, cloudformation_*, dynamodb_*, sqs_*. Call with no args for help.",
  input: {
    command: {
      description: "Command to execute (omit for help)",
      required: false,
      type: String,
    },
    input: {
      description: "Command parameters",
      required: false,
      type: Object,
    },
  },
  service: async ({
    command,
    input: params,
  }: {
    command?: string;
    input?: AwsInput;
  }) => {
    if (!command || command === "help") {
      return getHelp();
    }

    const p = params || {};

    switch (command) {
      case "list_profiles": {
        const result = await listAwsProfiles(log);
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "lambda_list_functions": {
        const result = await listLambdaFunctions(
          {
            functionNamePrefix: p.functionNamePrefix,
            maxResults: p.maxResults,
            profile: p.profile,
            region: p.region,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "lambda_get_function": {
        if (!p.functionName) throw new Error("functionName is required");
        const result = await getLambdaFunction(
          {
            functionName: p.functionName,
            profile: p.profile,
            region: p.region,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "stepfunctions_list_executions": {
        if (!p.stateMachineArn) throw new Error("stateMachineArn is required");
        const result = await listStepFunctionExecutions(
          {
            maxResults: p.maxResults,
            profile: p.profile,
            region: p.region,
            stateMachineArn: p.stateMachineArn,
            statusFilter: p.statusFilter,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "stepfunctions_stop_execution": {
        if (!p.executionArn) throw new Error("executionArn is required");
        const result = await stopStepFunctionExecution(
          {
            cause: p.cause,
            executionArn: p.executionArn,
            profile: p.profile,
            region: p.region,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "logs_filter_log_events": {
        if (!p.logGroupName) throw new Error("logGroupName is required");
        const result = await filterLogEvents(
          {
            endTime: p.endTime || "now",
            filterPattern: p.filterPattern,
            limit: p.limit || 100,
            logGroupName: p.logGroupName,
            profile: p.profile,
            region: p.region,
            startTime: p.startTime || "now-15m",
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "s3_list_objects": {
        if (!p.bucket) throw new Error("bucket is required");
        const result = await listS3Objects(
          {
            bucket: p.bucket,
            maxResults: p.maxResults,
            prefix: p.prefix,
            profile: p.profile,
            region: p.region,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "cloudformation_describe_stack": {
        if (!p.stackName) throw new Error("stackName is required");
        const result = await describeStack(
          {
            profile: p.profile,
            region: p.region,
            stackName: p.stackName,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "dynamodb_describe_table": {
        if (!p.tableName) throw new Error("tableName is required");
        const result = await describeDynamoDBTable(
          {
            profile: p.profile,
            region: p.region,
            tableName: p.tableName,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "dynamodb_scan": {
        if (!p.tableName) throw new Error("tableName is required");
        const result = await scanDynamoDB(
          {
            expressionAttributeValues: p.expressionAttributeValues,
            filterExpression: p.filterExpression,
            limit: p.limit || 25,
            profile: p.profile,
            region: p.region,
            tableName: p.tableName,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "dynamodb_query": {
        if (!p.tableName) throw new Error("tableName is required");
        if (!p.keyConditionExpression)
          throw new Error("keyConditionExpression is required");
        if (!p.expressionAttributeValues)
          throw new Error("expressionAttributeValues is required");
        const result = await queryDynamoDB(
          {
            expressionAttributeValues: p.expressionAttributeValues,
            filterExpression: p.filterExpression,
            indexName: p.indexName,
            keyConditionExpression: p.keyConditionExpression,
            limit: p.limit,
            profile: p.profile,
            region: p.region,
            scanIndexForward: p.scanIndexForward,
            tableName: p.tableName,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "dynamodb_get_item": {
        if (!p.tableName) throw new Error("tableName is required");
        if (!p.key) throw new Error("key is required");
        const result = await getDynamoDBItem(
          {
            key: p.key,
            profile: p.profile,
            region: p.region,
            tableName: p.tableName,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "sqs_list_queues": {
        const result = await listSQSQueues(
          {
            profile: p.profile,
            queueNamePrefix: p.queueNamePrefix,
            region: p.region,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "sqs_get_queue_attributes": {
        if (!p.queueUrl) throw new Error("queueUrl is required");
        const result = await getSQSQueueAttributes(
          {
            profile: p.profile,
            queueUrl: p.queueUrl,
            region: p.region,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "sqs_receive_message": {
        if (!p.queueUrl) throw new Error("queueUrl is required");
        const result = await receiveSQSMessage(
          {
            maxNumberOfMessages: p.maxNumberOfMessages || 1,
            profile: p.profile,
            queueUrl: p.queueUrl,
            region: p.region,
            visibilityTimeout: p.visibilityTimeout || 30,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      }

      case "sqs_purge_queue": {
        if (!p.queueUrl) throw new Error("queueUrl is required");
        const result = await purgeSQSQueue(
          {
            profile: p.profile,
            queueUrl: p.queueUrl,
            region: p.region,
          },
          log,
        );
        if (!result.success) throw new Error(result.error);
        return { success: true };
      }

      default:
        throw new Error(`Unknown command: ${command}. Use aws() for help.`);
    }
  },
});

// Re-export types and functions for testing
export * from "./aws.js";
