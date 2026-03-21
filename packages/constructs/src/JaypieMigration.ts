import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as cr from "aws-cdk-lib/custom-resources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { CDK } from "./constants";
import { JaypieLambda } from "./JaypieLambda";
import type { SecretsArrayItem } from "./helpers/index.js";

export interface JaypieMigrationProps {
  /** Path to the bundled migration code (esbuild output directory) */
  code: lambda.Code | string;
  /** Constructs that must be created before the migration runs */
  dependencies?: Construct[];
  /** Lambda handler entry point */
  handler?: string;
  /** Secrets to make available to the migration Lambda */
  secrets?: SecretsArrayItem[];
  /** DynamoDB tables to grant read/write access */
  tables?: dynamodb.ITable[];
}

export class JaypieMigration extends Construct {
  public readonly lambda: JaypieLambda;

  constructor(scope: Construct, id: string, props: JaypieMigrationProps) {
    super(scope, id);

    const {
      code,
      dependencies = [],
      handler = "index.handler",
      secrets = [],
      tables = [],
    } = props;

    // Migration Lambda — 5 minute timeout for long-running migrations
    this.lambda = new JaypieLambda(this, "MigrationLambda", {
      code,
      description: "DynamoDB migration custom resource",
      handler,
      roleTag: CDK.ROLE.PROCESSING,
      secrets,
      tables,
      timeout: cdk.Duration.minutes(5),
    });

    // Custom Resource provider wrapping the Lambda
    const provider = new cr.Provider(this, "MigrationProvider", {
      onEventHandler: this.lambda,
    });

    // Custom Resource that triggers on every deploy
    const resource = new cdk.CustomResource(this, "MigrationResource", {
      serviceToken: provider.serviceToken,
    });

    // Ensure dependencies are created before the migration runs
    for (const dep of dependencies) {
      resource.node.addDependency(dep);
    }
  }
}
