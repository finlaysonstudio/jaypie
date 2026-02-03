/**
 * AWS CLI integration module
 * Provides a structured interface for common AWS operations via the AWS CLI
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// Logger interface matching the pattern from datadog.ts
interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const nullLogger: Logger = {
  info: () => {},
  error: () => {},
};

// Common AWS command options
export interface AwsCommandOptions {
  profile?: string;
  region?: string;
}

// Generic result type for AWS commands
export interface AwsCommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Step Functions types
export interface StepFunctionExecution {
  executionArn: string;
  stateMachineArn: string;
  name: string;
  status: string;
  startDate: string;
  stopDate?: string;
}

export interface StepFunctionsListExecutionsOptions extends AwsCommandOptions {
  stateMachineArn: string;
  statusFilter?:
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "TIMED_OUT"
    | "ABORTED"
    | "PENDING_REDRIVE";
  maxResults?: number;
}

export interface StepFunctionsStopExecutionOptions extends AwsCommandOptions {
  executionArn: string;
  cause?: string;
}

// Lambda types
export interface LambdaFunction {
  FunctionName: string;
  FunctionArn: string;
  Runtime?: string;
  Handler?: string;
  CodeSize: number;
  Description?: string;
  Timeout?: number;
  MemorySize?: number;
  LastModified: string;
  Version?: string;
}

export interface LambdaListFunctionsOptions extends AwsCommandOptions {
  functionNamePrefix?: string;
  maxResults?: number;
}

export interface LambdaGetFunctionOptions extends AwsCommandOptions {
  functionName: string;
}

// CloudWatch Logs types
export interface LogEvent {
  timestamp: number;
  message: string;
  ingestionTime?: number;
  logStreamName?: string;
}

export interface CloudWatchLogsFilterOptions extends AwsCommandOptions {
  logGroupName: string;
  filterPattern?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}

// S3 types
export interface S3Object {
  Key: string;
  LastModified: string;
  ETag: string;
  Size: number;
  StorageClass: string;
}

export interface S3ListObjectsOptions extends AwsCommandOptions {
  bucket: string;
  prefix?: string;
  maxResults?: number;
}

// CloudFormation types
export interface CloudFormationStack {
  StackName: string;
  StackId: string;
  StackStatus: string;
  StackStatusReason?: string;
  CreationTime: string;
  LastUpdatedTime?: string;
  Description?: string;
  Outputs?: Array<{
    OutputKey: string;
    OutputValue: string;
    Description?: string;
  }>;
  Parameters?: Array<{
    ParameterKey: string;
    ParameterValue: string;
  }>;
}

export interface CloudFormationDescribeStackOptions extends AwsCommandOptions {
  stackName: string;
}

// DynamoDB types
export interface DynamoDBDescribeTableOptions extends AwsCommandOptions {
  tableName: string;
}

export interface DynamoDBScanOptions extends AwsCommandOptions {
  tableName: string;
  filterExpression?: string;
  expressionAttributeValues?: string;
  limit?: number;
}

export interface DynamoDBQueryOptions extends AwsCommandOptions {
  tableName: string;
  keyConditionExpression: string;
  expressionAttributeValues: string;
  indexName?: string;
  filterExpression?: string;
  limit?: number;
  scanIndexForward?: boolean;
}

export interface DynamoDBGetItemOptions extends AwsCommandOptions {
  tableName: string;
  key: string;
}

// SQS types
export interface SQSQueue {
  QueueUrl: string;
}

export interface SQSListQueuesOptions extends AwsCommandOptions {
  queueNamePrefix?: string;
}

export interface SQSGetQueueAttributesOptions extends AwsCommandOptions {
  queueUrl: string;
}

export interface SQSReceiveMessageOptions extends AwsCommandOptions {
  queueUrl: string;
  maxNumberOfMessages?: number;
  visibilityTimeout?: number;
}

export interface SQSPurgeQueueOptions extends AwsCommandOptions {
  queueUrl: string;
}

// AWS Profile
export interface AwsProfile {
  name: string;
  source: "config" | "credentials";
  region?: string;
  sso_start_url?: string;
}

// Validation types
export interface AwsValidationResult {
  success: boolean;
  cliAvailable: boolean;
  cliVersion?: string;
  profiles: AwsProfile[];
}

/**
 * Parse AWS CLI error messages into user-friendly descriptions
 */
function parseAwsError(
  stderr: string,
  service: string,
  command: string,
): string {
  if (stderr.includes("ExpiredToken") || stderr.includes("Token has expired")) {
    return "AWS credentials have expired. Run 'aws sso login' or refresh your credentials.";
  }
  if (
    stderr.includes("NoCredentialProviders") ||
    stderr.includes("Unable to locate credentials")
  ) {
    return "No AWS credentials found. Configure credentials with 'aws configure' or 'aws sso login'.";
  }
  if (stderr.includes("AccessDenied") || stderr.includes("Access Denied")) {
    return `Access denied for ${service}:${command}. Check your IAM permissions.`;
  }
  if (stderr.includes("ResourceNotFoundException")) {
    return `Resource not found. Check that the specified resource exists in the correct region.`;
  }
  if (stderr.includes("ValidationException")) {
    const match = stderr.match(/ValidationException[^:]*:\s*(.+)/);
    return match
      ? `Validation error: ${match[1].trim()}`
      : "Validation error in request parameters.";
  }
  if (
    stderr.includes("ThrottlingException") ||
    stderr.includes("Rate exceeded")
  ) {
    return "AWS API rate limit exceeded. Wait a moment and try again.";
  }
  if (stderr.includes("InvalidParameterValue")) {
    const match = stderr.match(/InvalidParameterValue[^:]*:\s*(.+)/);
    return match
      ? `Invalid parameter: ${match[1].trim()}`
      : "Invalid parameter value provided.";
  }
  return stderr.trim();
}

/**
 * Parse relative time strings like 'now-1h' to Unix timestamps
 */
function parseRelativeTime(timeStr: string): number {
  const now = Date.now();

  if (timeStr === "now") {
    return now;
  }

  // Handle relative time like 'now-15m', 'now-1h', 'now-1d'
  const relativeMatch = timeStr.match(/^now-(\d+)([smhd])$/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return now - value * multipliers[unit];
  }

  // Handle ISO 8601 format
  const parsed = Date.parse(timeStr);
  if (!isNaN(parsed)) {
    return parsed;
  }

  // Default to the current time if parsing fails
  return now;
}

/**
 * Execute an AWS CLI command and return parsed JSON output
 */
export async function executeAwsCommand<T>(
  service: string,
  command: string,
  args: string[],
  options: AwsCommandOptions = {},
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<T>> {
  const fullArgs = [service, command, ...args, "--output", "json"];

  if (options.profile) {
    fullArgs.push("--profile", options.profile);
  }
  if (options.region) {
    fullArgs.push("--region", options.region);
  }

  logger.info(`Executing: aws ${fullArgs.join(" ")}`);

  return new Promise((resolve) => {
    const proc = spawn("aws", fullArgs);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        logger.error(`AWS CLI error: ${stderr}`);
        resolve({
          success: false,
          error: parseAwsError(stderr, service, command),
        });
        return;
      }

      // Handle empty output (some commands return nothing on success)
      if (!stdout.trim()) {
        resolve({ success: true });
        return;
      }

      try {
        const data = JSON.parse(stdout) as T;
        resolve({ success: true, data });
      } catch {
        // Some commands return plain text
        resolve({ success: true, data: stdout.trim() as unknown as T });
      }
    });

    proc.on("error", (error) => {
      if (error.message.includes("ENOENT")) {
        resolve({
          success: false,
          error:
            "AWS CLI not found. Install it from https://aws.amazon.com/cli/",
        });
      } else {
        resolve({ success: false, error: error.message });
      }
    });
  });
}

/**
 * Check if AWS CLI is available and get its version
 */
async function checkAwsCliVersion(): Promise<{
  available: boolean;
  version?: string;
}> {
  return new Promise((resolve) => {
    const proc = spawn("aws", ["--version"]);
    let stdout = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        // Output is like "aws-cli/2.15.0 Python/3.11.6 Darwin/23.2.0 source/arm64"
        const match = stdout.match(/aws-cli\/([\d.]+)/);
        resolve({
          available: true,
          version: match ? match[1] : stdout.trim(),
        });
      } else {
        resolve({ available: false });
      }
    });

    proc.on("error", () => {
      resolve({ available: false });
    });
  });
}

/**
 * Validate AWS setup without making API calls
 */
export async function validateAwsSetup(): Promise<AwsValidationResult> {
  const cliCheck = await checkAwsCliVersion();
  const profilesResult = await listAwsProfiles();

  return {
    cliAvailable: cliCheck.available,
    cliVersion: cliCheck.version,
    profiles: profilesResult.success ? (profilesResult.data ?? []) : [],
    success: cliCheck.available,
  };
}

/**
 * List available AWS profiles from ~/.aws/config and ~/.aws/credentials
 */
export async function listAwsProfiles(
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<AwsProfile[]>> {
  const profiles: AwsProfile[] = [];
  const homeDir = os.homedir();

  try {
    // Parse ~/.aws/config
    const configPath = path.join(homeDir, ".aws", "config");
    try {
      const configContent = await fs.readFile(configPath, "utf-8");
      const profileRegex = /\[profile\s+([^\]]+)\]|\[default\]/g;
      let match;
      while ((match = profileRegex.exec(configContent)) !== null) {
        const name = match[1] || "default";
        profiles.push({
          name,
          source: "config",
        });
      }
      logger.info(`Found ${profiles.length} profiles in config`);
    } catch {
      logger.info("No ~/.aws/config file found");
    }

    // Parse ~/.aws/credentials
    const credentialsPath = path.join(homeDir, ".aws", "credentials");
    try {
      const credentialsContent = await fs.readFile(credentialsPath, "utf-8");
      const profileRegex = /\[([^\]]+)\]/g;
      let match;
      while ((match = profileRegex.exec(credentialsContent)) !== null) {
        const name = match[1];
        // Only add if not already in the list
        if (!profiles.find((p) => p.name === name)) {
          profiles.push({
            name,
            source: "credentials",
          });
        }
      }
      logger.info(`Total profiles after credentials: ${profiles.length}`);
    } catch {
      logger.info("No ~/.aws/credentials file found");
    }

    return { success: true, data: profiles };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Error listing profiles: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// Step Functions operations
export async function listStepFunctionExecutions(
  options: StepFunctionsListExecutionsOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ executions: StepFunctionExecution[] }>> {
  const args = ["--state-machine-arn", options.stateMachineArn];
  if (options.statusFilter) {
    args.push("--status-filter", options.statusFilter);
  }
  if (options.maxResults) {
    args.push("--max-results", String(options.maxResults));
  }

  return executeAwsCommand(
    "stepfunctions",
    "list-executions",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}

export async function stopStepFunctionExecution(
  options: StepFunctionsStopExecutionOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ stopDate: string }>> {
  const args = ["--execution-arn", options.executionArn];
  if (options.cause) {
    args.push("--cause", options.cause);
  }

  return executeAwsCommand(
    "stepfunctions",
    "stop-execution",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}

// Lambda operations
export async function listLambdaFunctions(
  options: LambdaListFunctionsOptions = {},
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Functions: LambdaFunction[] }>> {
  const args: string[] = [];
  if (options.maxResults) {
    args.push("--max-items", String(options.maxResults));
  }

  const result = await executeAwsCommand<{ Functions: LambdaFunction[] }>(
    "lambda",
    "list-functions",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );

  // Filter by prefix if specified
  if (result.success && result.data && options.functionNamePrefix) {
    result.data.Functions = result.data.Functions.filter((f) =>
      f.FunctionName.startsWith(options.functionNamePrefix!),
    );
  }

  return result;
}

export async function getLambdaFunction(
  options: LambdaGetFunctionOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Configuration: LambdaFunction }>> {
  return executeAwsCommand(
    "lambda",
    "get-function",
    ["--function-name", options.functionName],
    { profile: options.profile, region: options.region },
    logger,
  );
}

// CloudWatch Logs operations
export async function filterLogEvents(
  options: CloudWatchLogsFilterOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ events: LogEvent[] }>> {
  const args = ["--log-group-name", options.logGroupName];

  if (options.filterPattern) {
    args.push("--filter-pattern", options.filterPattern);
  }
  if (options.startTime) {
    const startMs = parseRelativeTime(options.startTime);
    args.push("--start-time", String(startMs));
  }
  if (options.endTime) {
    const endMs = parseRelativeTime(options.endTime);
    args.push("--end-time", String(endMs));
  }
  if (options.limit) {
    args.push("--limit", String(options.limit));
  }

  return executeAwsCommand(
    "logs",
    "filter-log-events",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}

// S3 operations
export async function listS3Objects(
  options: S3ListObjectsOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Contents: S3Object[] }>> {
  const args = ["--bucket", options.bucket];
  if (options.prefix) {
    args.push("--prefix", options.prefix);
  }
  if (options.maxResults) {
    args.push("--max-items", String(options.maxResults));
  }

  return executeAwsCommand(
    "s3api",
    "list-objects-v2",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}

// CloudFormation operations
export async function describeStack(
  options: CloudFormationDescribeStackOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Stacks: CloudFormationStack[] }>> {
  return executeAwsCommand(
    "cloudformation",
    "describe-stacks",
    ["--stack-name", options.stackName],
    { profile: options.profile, region: options.region },
    logger,
  );
}

// DynamoDB operations
export async function describeDynamoDBTable(
  options: DynamoDBDescribeTableOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Table: Record<string, unknown> }>> {
  return executeAwsCommand(
    "dynamodb",
    "describe-table",
    ["--table-name", options.tableName],
    { profile: options.profile, region: options.region },
    logger,
  );
}

export async function scanDynamoDB(
  options: DynamoDBScanOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Items: Record<string, unknown>[] }>> {
  const args = ["--table-name", options.tableName];
  if (options.filterExpression) {
    args.push("--filter-expression", options.filterExpression);
  }
  if (options.expressionAttributeValues) {
    args.push(
      "--expression-attribute-values",
      options.expressionAttributeValues,
    );
  }
  if (options.limit) {
    args.push("--limit", String(options.limit));
  }

  return executeAwsCommand(
    "dynamodb",
    "scan",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}

export async function queryDynamoDB(
  options: DynamoDBQueryOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Items: Record<string, unknown>[] }>> {
  const args = [
    "--table-name",
    options.tableName,
    "--key-condition-expression",
    options.keyConditionExpression,
    "--expression-attribute-values",
    options.expressionAttributeValues,
  ];
  if (options.indexName) {
    args.push("--index-name", options.indexName);
  }
  if (options.filterExpression) {
    args.push("--filter-expression", options.filterExpression);
  }
  if (options.limit) {
    args.push("--limit", String(options.limit));
  }
  if (options.scanIndexForward === false) {
    args.push("--no-scan-index-forward");
  }

  return executeAwsCommand(
    "dynamodb",
    "query",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}

export async function getDynamoDBItem(
  options: DynamoDBGetItemOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Item: Record<string, unknown> }>> {
  return executeAwsCommand(
    "dynamodb",
    "get-item",
    ["--table-name", options.tableName, "--key", options.key],
    { profile: options.profile, region: options.region },
    logger,
  );
}

// SQS operations
export async function listSQSQueues(
  options: SQSListQueuesOptions = {},
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ QueueUrls: string[] }>> {
  const args: string[] = [];
  if (options.queueNamePrefix) {
    args.push("--queue-name-prefix", options.queueNamePrefix);
  }

  return executeAwsCommand(
    "sqs",
    "list-queues",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}

export async function getSQSQueueAttributes(
  options: SQSGetQueueAttributesOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<{ Attributes: Record<string, string> }>> {
  return executeAwsCommand(
    "sqs",
    "get-queue-attributes",
    ["--queue-url", options.queueUrl, "--attribute-names", "All"],
    { profile: options.profile, region: options.region },
    logger,
  );
}

export async function receiveSQSMessage(
  options: SQSReceiveMessageOptions,
  logger: Logger = nullLogger,
): Promise<
  AwsCommandResult<{
    Messages: Array<{
      MessageId: string;
      ReceiptHandle: string;
      Body: string;
      Attributes?: Record<string, string>;
    }>;
  }>
> {
  const args = ["--queue-url", options.queueUrl];
  if (options.maxNumberOfMessages) {
    args.push("--max-number-of-messages", String(options.maxNumberOfMessages));
  }
  if (options.visibilityTimeout) {
    args.push("--visibility-timeout", String(options.visibilityTimeout));
  }
  args.push("--attribute-names", "All");

  return executeAwsCommand(
    "sqs",
    "receive-message",
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}

export async function purgeSQSQueue(
  options: SQSPurgeQueueOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<void>> {
  return executeAwsCommand(
    "sqs",
    "purge-queue",
    ["--queue-url", options.queueUrl],
    { profile: options.profile, region: options.region },
    logger,
  );
}
