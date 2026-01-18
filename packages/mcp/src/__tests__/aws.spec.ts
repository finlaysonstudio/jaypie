import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { EventEmitter } from "node:events";
import {
  executeAwsCommand,
  listAwsProfiles,
  listStepFunctionExecutions,
  stopStepFunctionExecution,
  listLambdaFunctions,
  getLambdaFunction,
  filterLogEvents,
  listS3Objects,
  describeStack,
  describeDynamoDBTable,
  scanDynamoDB,
  queryDynamoDB,
  getDynamoDBItem,
  listSQSQueues,
  getSQSQueueAttributes,
  receiveSQSMessage,
  purgeSQSQueue,
} from "../aws.js";

// Mock child_process.spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock fs/promises for profile listing
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

// Mock os for homedir
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

type MockSpawn = ReturnType<typeof vi.fn>;
type MockReadFile = ReturnType<typeof vi.fn>;

function createMockProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

function mockSuccessfulSpawn(
  mockSpawn: MockSpawn,
  responseData: unknown,
): void {
  const proc = createMockProcess();
  mockSpawn.mockReturnValue(proc);

  // Schedule the response asynchronously
  setImmediate(() => {
    proc.stdout.emit("data", JSON.stringify(responseData));
    proc.emit("close", 0);
  });
}

function mockFailedSpawn(mockSpawn: MockSpawn, stderr: string): void {
  const proc = createMockProcess();
  mockSpawn.mockReturnValue(proc);

  setImmediate(() => {
    proc.stderr.emit("data", stderr);
    proc.emit("close", 1);
  });
}

function mockSpawnError(mockSpawn: MockSpawn, errorMessage: string): void {
  const proc = createMockProcess();
  mockSpawn.mockReturnValue(proc);

  setImmediate(() => {
    proc.emit("error", new Error(errorMessage));
  });
}

describe("aws", () => {
  const mockSpawn = childProcess.spawn as unknown as MockSpawn;
  const mockReadFile = fs.readFile as unknown as MockReadFile;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("executeAwsCommand", () => {
    describe("Base Cases", () => {
      it("is a Function", () => {
        expect(executeAwsCommand).toBeInstanceOf(Function);
      });
    });

    describe("Happy Paths", () => {
      it("executes a successful AWS command", async () => {
        const testData = { test: "data" };
        mockSuccessfulSpawn(mockSpawn, testData);

        const result = await executeAwsCommand("s3", "ls", []);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(testData);
        expect(mockSpawn).toHaveBeenCalledWith("aws", [
          "s3",
          "ls",
          "--output",
          "json",
        ]);
      });

      it("includes profile when specified", async () => {
        mockSuccessfulSpawn(mockSpawn, {});

        await executeAwsCommand("s3", "ls", [], { profile: "my-profile" });

        expect(mockSpawn).toHaveBeenCalledWith("aws", [
          "s3",
          "ls",
          "--output",
          "json",
          "--profile",
          "my-profile",
        ]);
      });

      it("includes region when specified", async () => {
        mockSuccessfulSpawn(mockSpawn, {});

        await executeAwsCommand("s3", "ls", [], { region: "us-west-2" });

        expect(mockSpawn).toHaveBeenCalledWith("aws", [
          "s3",
          "ls",
          "--output",
          "json",
          "--region",
          "us-west-2",
        ]);
      });

      it("handles empty output successfully", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc);

        const resultPromise = executeAwsCommand("sqs", "purge-queue", []);

        setImmediate(() => {
          proc.stdout.emit("data", "");
          proc.emit("close", 0);
        });

        const result = await resultPromise;
        expect(result.success).toBe(true);
      });
    });

    describe("Error Handling", () => {
      it("handles expired token error", async () => {
        mockFailedSpawn(mockSpawn, "ExpiredToken: Token has expired");

        const result = await executeAwsCommand("s3", "ls", []);

        expect(result.success).toBe(false);
        expect(result.error).toContain("credentials have expired");
      });

      it("handles no credentials error", async () => {
        mockFailedSpawn(
          mockSpawn,
          "Unable to locate credentials. You can configure credentials",
        );

        const result = await executeAwsCommand("s3", "ls", []);

        expect(result.success).toBe(false);
        expect(result.error).toContain("No AWS credentials found");
      });

      it("handles access denied error", async () => {
        mockFailedSpawn(mockSpawn, "AccessDenied: User is not authorized");

        const result = await executeAwsCommand("s3", "ls", []);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Access denied");
        expect(result.error).toContain("s3:ls");
      });

      it("handles AWS CLI not found", async () => {
        mockSpawnError(mockSpawn, "ENOENT");

        const result = await executeAwsCommand("s3", "ls", []);

        expect(result.success).toBe(false);
        expect(result.error).toContain("AWS CLI not found");
      });

      it("handles resource not found error", async () => {
        mockFailedSpawn(
          mockSpawn,
          "ResourceNotFoundException: Table not found",
        );

        const result = await executeAwsCommand("dynamodb", "scan", []);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Resource not found");
      });

      it("handles throttling error", async () => {
        mockFailedSpawn(mockSpawn, "ThrottlingException: Rate exceeded");

        const result = await executeAwsCommand("lambda", "list-functions", []);

        expect(result.success).toBe(false);
        expect(result.error).toContain("rate limit exceeded");
      });
    });
  });

  describe("listAwsProfiles", () => {
    describe("Happy Paths", () => {
      it("parses profiles from config file", async () => {
        mockReadFile.mockImplementation((filePath: string) => {
          if (filePath.includes("config")) {
            return Promise.resolve(`[default]
region = us-east-1

[profile dev]
region = us-west-2

[profile prod]
region = eu-west-1
`);
          }
          return Promise.reject(new Error("File not found"));
        });

        const result = await listAwsProfiles();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
        expect(result.data?.map((p) => p.name)).toContain("default");
        expect(result.data?.map((p) => p.name)).toContain("dev");
        expect(result.data?.map((p) => p.name)).toContain("prod");
      });

      it("parses profiles from credentials file", async () => {
        mockReadFile.mockImplementation((filePath: string) => {
          if (filePath.includes("credentials")) {
            return Promise.resolve(`[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE

[dev]
aws_access_key_id = AKIAI44QH8DHBEXAMPLE
`);
          }
          return Promise.reject(new Error("File not found"));
        });

        const result = await listAwsProfiles();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
      });

      it("deduplicates profiles from both files", async () => {
        mockReadFile.mockImplementation((filePath: string) => {
          if (filePath.includes("config")) {
            return Promise.resolve(`[default]
region = us-east-1
`);
          }
          if (filePath.includes("credentials")) {
            return Promise.resolve(`[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
`);
          }
          return Promise.reject(new Error("File not found"));
        });

        const result = await listAwsProfiles();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0].name).toBe("default");
      });

      it("handles missing config files gracefully", async () => {
        mockReadFile.mockRejectedValue(new Error("ENOENT: no such file"));

        const result = await listAwsProfiles();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });
    });
  });

  describe("Step Functions", () => {
    describe("listStepFunctionExecutions", () => {
      it("lists executions successfully", async () => {
        const mockExecutions = {
          executions: [
            {
              executionArn: "arn:aws:states:us-east-1:123456789:execution:test",
              name: "test-execution",
              status: "RUNNING",
              startDate: "2024-01-15T10:00:00Z",
            },
          ],
        };
        mockSuccessfulSpawn(mockSpawn, mockExecutions);

        const result = await listStepFunctionExecutions({
          stateMachineArn: "arn:aws:states:us-east-1:123456789:stateMachine:test",
        });

        expect(result.success).toBe(true);
        expect(result.data?.executions).toHaveLength(1);
      });

      it("includes status filter when specified", async () => {
        mockSuccessfulSpawn(mockSpawn, { executions: [] });

        await listStepFunctionExecutions({
          stateMachineArn: "arn:aws:states:us-east-1:123456789:stateMachine:test",
          statusFilter: "RUNNING",
        });

        expect(mockSpawn).toHaveBeenCalledWith(
          "aws",
          expect.arrayContaining(["--status-filter", "RUNNING"]),
        );
      });
    });

    describe("stopStepFunctionExecution", () => {
      it("stops execution successfully", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          stopDate: "2024-01-15T10:30:00Z",
        });

        const result = await stopStepFunctionExecution({
          executionArn: "arn:aws:states:us-east-1:123456789:execution:test",
        });

        expect(result.success).toBe(true);
        expect(result.data?.stopDate).toBeDefined();
      });
    });
  });

  describe("Lambda", () => {
    describe("listLambdaFunctions", () => {
      it("lists functions successfully", async () => {
        const mockFunctions = {
          Functions: [
            {
              FunctionName: "my-function",
              FunctionArn: "arn:aws:lambda:us-east-1:123456789:function:my-function",
              Runtime: "nodejs20.x",
              MemorySize: 128,
              CodeSize: 1024,
              LastModified: "2024-01-15T10:00:00Z",
            },
          ],
        };
        mockSuccessfulSpawn(mockSpawn, mockFunctions);

        const result = await listLambdaFunctions();

        expect(result.success).toBe(true);
        expect(result.data?.Functions).toHaveLength(1);
      });

      it("filters by function name prefix", async () => {
        const mockFunctions = {
          Functions: [
            { FunctionName: "my-function-a", Runtime: "nodejs20.x", MemorySize: 128, CodeSize: 1024, LastModified: "", FunctionArn: "" },
            { FunctionName: "my-function-b", Runtime: "nodejs20.x", MemorySize: 128, CodeSize: 1024, LastModified: "", FunctionArn: "" },
            { FunctionName: "other-function", Runtime: "nodejs20.x", MemorySize: 128, CodeSize: 1024, LastModified: "", FunctionArn: "" },
          ],
        };
        mockSuccessfulSpawn(mockSpawn, mockFunctions);

        const result = await listLambdaFunctions({
          functionNamePrefix: "my-function",
        });

        expect(result.success).toBe(true);
        expect(result.data?.Functions).toHaveLength(2);
      });
    });

    describe("getLambdaFunction", () => {
      it("gets function details", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          Configuration: {
            FunctionName: "my-function",
            Runtime: "nodejs20.x",
          },
        });

        const result = await getLambdaFunction({
          functionName: "my-function",
        });

        expect(result.success).toBe(true);
        expect(result.data?.Configuration).toBeDefined();
      });
    });
  });

  describe("CloudWatch Logs", () => {
    describe("filterLogEvents", () => {
      it("filters log events successfully", async () => {
        const mockEvents = {
          events: [
            {
              timestamp: 1705312800000,
              message: "Test log message",
            },
          ],
        };
        mockSuccessfulSpawn(mockSpawn, mockEvents);

        const result = await filterLogEvents({
          logGroupName: "/aws/lambda/my-function",
        });

        expect(result.success).toBe(true);
        expect(result.data?.events).toHaveLength(1);
      });

      it("includes filter pattern when specified", async () => {
        mockSuccessfulSpawn(mockSpawn, { events: [] });

        await filterLogEvents({
          logGroupName: "/aws/lambda/my-function",
          filterPattern: "ERROR",
        });

        expect(mockSpawn).toHaveBeenCalledWith(
          "aws",
          expect.arrayContaining(["--filter-pattern", "ERROR"]),
        );
      });
    });
  });

  describe("S3", () => {
    describe("listS3Objects", () => {
      it("lists objects successfully", async () => {
        const mockObjects = {
          Contents: [
            {
              Key: "file.txt",
              Size: 1024,
              LastModified: "2024-01-15T10:00:00Z",
              ETag: '"abc123"',
              StorageClass: "STANDARD",
            },
          ],
        };
        mockSuccessfulSpawn(mockSpawn, mockObjects);

        const result = await listS3Objects({
          bucket: "my-bucket",
        });

        expect(result.success).toBe(true);
        expect(result.data?.Contents).toHaveLength(1);
      });

      it("includes prefix when specified", async () => {
        mockSuccessfulSpawn(mockSpawn, { Contents: [] });

        await listS3Objects({
          bucket: "my-bucket",
          prefix: "logs/",
        });

        expect(mockSpawn).toHaveBeenCalledWith(
          "aws",
          expect.arrayContaining(["--prefix", "logs/"]),
        );
      });
    });
  });

  describe("CloudFormation", () => {
    describe("describeStack", () => {
      it("describes stack successfully", async () => {
        const mockStack = {
          Stacks: [
            {
              StackName: "my-stack",
              StackId: "arn:aws:cloudformation:us-east-1:123456789:stack/my-stack",
              StackStatus: "CREATE_COMPLETE",
              CreationTime: "2024-01-15T10:00:00Z",
            },
          ],
        };
        mockSuccessfulSpawn(mockSpawn, mockStack);

        const result = await describeStack({
          stackName: "my-stack",
        });

        expect(result.success).toBe(true);
        expect(result.data?.Stacks).toHaveLength(1);
      });
    });
  });

  describe("DynamoDB", () => {
    describe("describeDynamoDBTable", () => {
      it("describes table successfully", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          Table: {
            TableName: "my-table",
            KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
          },
        });

        const result = await describeDynamoDBTable({
          tableName: "my-table",
        });

        expect(result.success).toBe(true);
        expect(result.data?.Table).toBeDefined();
      });
    });

    describe("scanDynamoDB", () => {
      it("scans table successfully", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          Items: [{ pk: { S: "item1" } }],
        });

        const result = await scanDynamoDB({
          tableName: "my-table",
        });

        expect(result.success).toBe(true);
        expect(result.data?.Items).toHaveLength(1);
      });
    });

    describe("queryDynamoDB", () => {
      it("queries table successfully", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          Items: [{ pk: { S: "item1" } }],
        });

        const result = await queryDynamoDB({
          tableName: "my-table",
          keyConditionExpression: "pk = :pk",
          expressionAttributeValues: '{ ":pk": { "S": "value" } }',
        });

        expect(result.success).toBe(true);
        expect(result.data?.Items).toHaveLength(1);
      });
    });

    describe("getDynamoDBItem", () => {
      it("gets item successfully", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          Item: { pk: { S: "item1" } },
        });

        const result = await getDynamoDBItem({
          tableName: "my-table",
          key: '{ "pk": { "S": "item1" } }',
        });

        expect(result.success).toBe(true);
        expect(result.data?.Item).toBeDefined();
      });
    });
  });

  describe("SQS", () => {
    describe("listSQSQueues", () => {
      it("lists queues successfully", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          QueueUrls: ["https://sqs.us-east-1.amazonaws.com/123456789/my-queue"],
        });

        const result = await listSQSQueues();

        expect(result.success).toBe(true);
        expect(result.data?.QueueUrls).toHaveLength(1);
      });

      it("includes prefix when specified", async () => {
        mockSuccessfulSpawn(mockSpawn, { QueueUrls: [] });

        await listSQSQueues({
          queueNamePrefix: "my-",
        });

        expect(mockSpawn).toHaveBeenCalledWith(
          "aws",
          expect.arrayContaining(["--queue-name-prefix", "my-"]),
        );
      });
    });

    describe("getSQSQueueAttributes", () => {
      it("gets queue attributes successfully", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          Attributes: {
            ApproximateNumberOfMessages: "5",
            VisibilityTimeout: "30",
          },
        });

        const result = await getSQSQueueAttributes({
          queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
        });

        expect(result.success).toBe(true);
        expect(result.data?.Attributes).toBeDefined();
      });
    });

    describe("receiveSQSMessage", () => {
      it("receives messages successfully", async () => {
        mockSuccessfulSpawn(mockSpawn, {
          Messages: [
            {
              MessageId: "msg-1",
              Body: "Test message",
              ReceiptHandle: "handle",
            },
          ],
        });

        const result = await receiveSQSMessage({
          queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
        });

        expect(result.success).toBe(true);
        expect(result.data?.Messages).toHaveLength(1);
      });
    });

    describe("purgeSQSQueue", () => {
      it("purges queue successfully", async () => {
        const proc = createMockProcess();
        mockSpawn.mockReturnValue(proc);

        const resultPromise = purgeSQSQueue({
          queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
        });

        setImmediate(() => {
          proc.emit("close", 0);
        });

        const result = await resultPromise;
        expect(result.success).toBe(true);
      });
    });
  });
});
