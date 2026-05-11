import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as cr from "aws-cdk-lib/custom-resources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { CDK } from "./constants";
import { JaypieLambda } from "./JaypieLambda";
import type { SecretsArrayItem } from "./helpers/index.js";

const DYNAMODB_CONTROL_PLANE_ACTIONS = [
  "dynamodb:DescribeContinuousBackups",
  "dynamodb:DescribeTable",
  "dynamodb:DescribeTimeToLive",
  "dynamodb:UpdateContinuousBackups",
  "dynamodb:UpdateTable",
  "dynamodb:UpdateTimeToLive",
];

export interface JaypieMigrationProps {
  /** Path to the bundled migration code (esbuild output directory) */
  code: lambda.Code | string;
  /** Constructs that must be created before the migration runs */
  dependencies?: Construct[];
  /** Environment variables for the migration Lambda */
  environment?: Record<string, string> | (Record<string, string> | string)[];
  /** Lambda handler entry point */
  handler?: string;
  /** Polling interval between isCompleteHandler invocations. Default: 60 seconds. */
  queryInterval?: cdk.Duration;
  /** Secrets to make available to the migration Lambda */
  secrets?: SecretsArrayItem[];
  /** DynamoDB tables to grant read/write access */
  tables?: dynamodb.ITable[];
  /** Lambda timeout per invocation. Defaults to 15 minutes (Lambda max). */
  timeout?: cdk.Duration;
  /** Maximum total wall time across all isCompleteHandler invocations. Default: 2 hours. */
  totalTimeout?: cdk.Duration;
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
      queryInterval = cdk.Duration.seconds(60),
      secrets = [],
      tables = [],
      timeout = cdk.Duration.minutes(15),
      totalTimeout = cdk.Duration.hours(2),
    } = props;

    this.lambda = new JaypieLambda(this, "MigrationLambda", {
      code,
      description: "DynamoDB migration custom resource",
      environment,
      handler,
      roleTag: CDK.ROLE.PROCESSING,
      secrets,
      tables,
      timeout,
    });

    // Grant control-plane perms on the passed tables so migrations that
    // alter table shape (GSIs, TTL, streams, backups) succeed. JaypieLambda
    // only grants data-plane access via grantReadWriteData. Issue #339.
    if (tables.length > 0) {
      this.lambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: DYNAMODB_CONTROL_PLANE_ACTIONS,
          resources: tables.flatMap((table) => [
            table.tableArn,
            `${table.tableArn}/index/*`,
          ]),
        }),
      );
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
