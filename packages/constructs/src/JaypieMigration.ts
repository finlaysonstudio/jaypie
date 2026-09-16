import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as cr from "aws-cdk-lib/custom-resources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { CDK } from "./constants";
import { JaypieDynamoDb } from "./JaypieDynamoDb";
import { JaypieLambda } from "./JaypieLambda";
import type { EnvironmentInput, SecretsArrayItem } from "./helpers/index.js";

const DYNAMODB_DESCRIBE_ACTIONS = [
  "dynamodb:DescribeContinuousBackups",
  "dynamodb:DescribeTable",
  "dynamodb:DescribeTimeToLive",
];

const WARNING_TABLE_WITHOUT_INDEXES =
  "@jaypie/constructs:migrationTableWithoutIndexes";

export interface JaypieMigrationProps {
  /** Path to the bundled migration code (esbuild output directory) */
  code: lambda.Code | string;
  /** Constructs that must be created before the migration runs */
  dependencies?: Construct[];
  /** Environment variables for the migration Lambda */
  environment?: Record<string, string> | (Record<string, string> | string)[];
  /** Lambda handler entry point */
  handler?: string;
  /** Log group for the migration Lambda. Defaults to a group created by JaypieLambda. */
  logGroup?: logs.ILogGroup;
  /** Retention for the JaypieLambda-created log group. Ignored when logGroup is provided. */
  logRetention?: logs.RetentionDays | number;
  /** Polling interval between isCompleteHandler invocations. Default: 60 seconds. */
  queryInterval?: cdk.Duration;
  /** Reserved concurrency for the migration Lambda. Default: unreserved. */
  reservedConcurrentExecutions?: number;
  /** Secrets to make available to the migration Lambda */
  secrets?: SecretsArrayItem[];
  /** DynamoDB tables to grant read/write access */
  tables?: dynamodb.ITable[];
  /** Lambda timeout per invocation. Defaults to 15 minutes (Lambda max). */
  timeout?: cdk.Duration;
  /** Maximum total wall time across all isCompleteHandler invocations. Default: 2 hours. */
  totalTimeout?: cdk.Duration;
  /** Non-secret values stored in a parameter and hydrated into process.env */
  variables?: EnvironmentInput;
}

export class JaypieMigration extends Construct {
  public readonly lambda: JaypieLambda;

  constructor(scope: Construct, id: string, props: JaypieMigrationProps) {
    super(scope, id);

    const {
      code,
      dependencies = [],
      environment,
      handler = "index.handler",
      logGroup,
      logRetention,
      queryInterval = cdk.Duration.seconds(60),
      reservedConcurrentExecutions,
      secrets = [],
      tables = [],
      timeout = cdk.Duration.minutes(15),
      totalTimeout = cdk.Duration.hours(2),
      variables,
    } = props;

    this.lambda = new JaypieLambda(this, "MigrationLambda", {
      code,
      description: "DynamoDB migration custom resource",
      environment,
      handler,
      logGroup,
      logRetention,
      reservedConcurrentExecutions,
      roleTag: CDK.ROLE.PROCESSING,
      secrets,
      tables,
      timeout,
      variables,
    });

    // Grant describe perms so migrations can inspect table shape. CDK owns
    // indexes, TTL, and backups: an index a migration creates blocks every later
    // CloudFormation update to the table, so no Update* actions (#339, #552).
    if (tables.length > 0) {
      this.lambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: DYNAMODB_DESCRIBE_ACTIONS,
          resources: tables.flatMap((table) => [
            table.tableArn,
            `${table.tableArn}/index/*`,
          ]),
        }),
      );
    }

    for (const table of tables) {
      if (table instanceof JaypieDynamoDb && table.indexes.length === 0) {
        cdk.Annotations.of(this).addWarningV2(
          WARNING_TABLE_WITHOUT_INDEXES,
          `JaypieDynamoDb "${table.node.path}" declares no indexes. Declare every registered fabricIndex() in JaypieDynamoDb indexes; migrations cannot create indexes. See skill("dynamodb").`,
        );
      }
    }

    // cr.Provider with isCompleteHandler enables the waiter pattern: onEventHandler
    // returns PhysicalResourceId immediately; isCompleteHandler is polled via Step
    // Functions until migrationHandler returns pending: false (or omits pending).
    const provider = new cr.Provider(this, "MigrationProvider", {
      isCompleteHandler: this.lambda,
      onEventHandler: this.lambda,
      queryInterval,
      totalTimeout,
    });

    // Custom Resource that triggers on every deploy.
    // deployNonce forces CloudFormation to re-invoke the custom resource
    // even when only Lambda code changes (issue #261).
    const resource = new cdk.CustomResource(this, "MigrationResource", {
      properties: {
        deployNonce: Date.now().toString(),
      },
      serviceToken: provider.serviceToken,
    });

    // Ensure dependencies are created before the migration runs
    for (const dep of dependencies) {
      resource.node.addDependency(dep);
    }
  }
}
