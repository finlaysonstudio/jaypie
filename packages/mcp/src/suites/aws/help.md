# AWS CLI Tools

Access AWS services through the AWS CLI. Requires AWS CLI installed and configured.

## Commands

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `validate` | Validate AWS setup (CLI availability, profiles) | - |
| `list_profiles` | List AWS profiles | - |
| `lambda_list_functions` | List Lambda functions | - |
| `lambda_get_function` | Get function details | `functionName` |
| `stepfunctions_list_executions` | List Step Function executions | `stateMachineArn` |
| `stepfunctions_stop_execution` | Stop a running execution | `executionArn` |
| `logs_filter_log_events` | Search CloudWatch Logs | `logGroupName` |
| `s3_list_objects` | List bucket objects | `bucket` |
| `cloudformation_describe_stack` | Get stack details | `stackName` |
| `dynamodb_describe_table` | Get table metadata | `tableName` |
| `dynamodb_scan` | Scan table | `tableName` |
| `dynamodb_query` | Query by partition key | `tableName`, `keyConditionExpression`, `expressionAttributeValues` |
| `dynamodb_get_item` | Get single item | `tableName`, `key` |
| `sqs_list_queues` | List queues | - |
| `sqs_get_queue_attributes` | Get queue details | `queueUrl` |
| `sqs_receive_message` | Peek at messages | `queueUrl` |
| `sqs_purge_queue` | Delete all messages | `queueUrl` |

## Parameters

All parameters are passed at the top level (flat structure):

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | string | Command to execute (omit for help) |
| `profile` | string | AWS profile name |
| `region` | string | AWS region (e.g., us-east-1) |
| `functionName` | string | Lambda function name |
| `functionNamePrefix` | string | Lambda function name prefix filter |
| `stateMachineArn` | string | Step Functions state machine ARN |
| `executionArn` | string | Step Functions execution ARN |
| `statusFilter` | string | Step Functions status: RUNNING, SUCCEEDED, FAILED, TIMED_OUT, ABORTED, PENDING_REDRIVE |
| `cause` | string | Cause for stopping Step Functions execution |
| `logGroupName` | string | CloudWatch Logs group name |
| `filterPattern` | string | CloudWatch Logs filter pattern |
| `startTime` | string | Start time (e.g., now-15m) |
| `endTime` | string | End time (e.g., now) |
| `bucket` | string | S3 bucket name |
| `prefix` | string | S3 object prefix filter |
| `stackName` | string | CloudFormation stack name |
| `tableName` | string | DynamoDB table name |
| `keyConditionExpression` | string | DynamoDB key condition expression |
| `expressionAttributeValues` | string | DynamoDB expression attribute values (JSON string) |
| `filterExpression` | string | DynamoDB filter expression |
| `indexName` | string | DynamoDB index name |
| `key` | string | DynamoDB item key (JSON string) |
| `scanIndexForward` | boolean | DynamoDB scan direction (true=ascending) |
| `queueUrl` | string | SQS queue URL |
| `queueNamePrefix` | string | SQS queue name prefix filter |
| `maxNumberOfMessages` | number | SQS max messages to receive |
| `visibilityTimeout` | number | SQS message visibility timeout in seconds |
| `limit` | number | Maximum number of results |
| `maxResults` | number | Maximum number of results |

## Examples

```
# List AWS profiles
aws({ command: "list_profiles" })

# List Lambda functions in a region
aws({ command: "lambda_list_functions", region: "us-east-1", functionNamePrefix: "my-app" })

# Query DynamoDB
aws({
  command: "dynamodb_query",
  tableName: "my-table",
  keyConditionExpression: "pk = :pk",
  expressionAttributeValues: "{\":pk\":{\"S\":\"user#123\"}}"
})

# Filter CloudWatch Logs
aws({
  command: "logs_filter_log_events",
  logGroupName: "/aws/lambda/my-function",
  filterPattern: "ERROR",
  startTime: "now-1h"
})
```
