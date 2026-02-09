import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import {
  envHostname,
  JaypieAppStack,
  JaypieDistribution,
  JaypieExpressLambda,
} from "@jaypie/constructs";

const DEFAULT_ZONE = "jaypie.net";

export interface GardenApiStackProps {
  /**
   * Override the default host for the garden API
   * @default envHostname({ subdomain: "garden-api" }) - e.g., "garden-api.jaypie.net" for production
   */
  host?: string;
  /**
   * DynamoDB table to grant read/write access to the Lambda function
   */
  table?: dynamodb.ITable;
  /**
   * Override the default hosted zone
   * @default CDK_ENV_HOSTED_ZONE or "jaypie.net"
   */
  zone?: string;
}

export class GardenApiStack extends JaypieAppStack {
  public readonly distribution: JaypieDistribution;
  public readonly lambda: JaypieExpressLambda;

  constructor(scope: Construct, id?: string, props: GardenApiStackProps = {}) {
    super(scope, id ?? "JaypieGardenApiStack", { key: "garden-api" });

    const zone = props.zone ?? process.env.CDK_ENV_HOSTED_ZONE ?? DEFAULT_ZONE;
    const host =
      props.host ??
      envHostname({ component: "api", domain: zone, subdomain: "garden" });

    this.lambda = new JaypieExpressLambda(this, "GardenApiLambda", {
      code: "../garden-api/dist",
      handler: "index.handler",
      ...(props.table ? { tables: [props.table] } : {}),
    });

    this.distribution = new JaypieDistribution(this, "GardenApiDistribution", {
      handler: this.lambda,
      host,
      streaming: true,
      zone,
    });
  }
}
