# AWS CLI Tools

Access AWS services through the AWS CLI. Requires AWS CLI installed and configured.

## Commands

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
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

## Common Options

All commands accept:
- `profile` - AWS profile to use
- `region` - AWS region

## Examples

```
aws("list_profiles")
aws("lambda_list_functions", { region: "us-east-1", functionNamePrefix: "my-app" })
aws("dynamodb_query", {
  tableName: "my-table",
  keyConditionExpression: "pk = :pk",
  expressionAttributeValues: "{\":pk\":{\"S\":\"user#123\"}}"
})
```
