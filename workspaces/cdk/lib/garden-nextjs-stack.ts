import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { envHostname, JaypieAppStack, JaypieNextJs } from "@jaypie/constructs";

const DEFAULT_ZONE = "jaypie.net";

export interface GardenNextjsStackProps {
  /**
   * Override the default host for the garden site
   * @default envHostname({ subdomain: "garden" }) - e.g., "garden.jaypie.net" for production
   */
  host?: string;
  /**
   * DynamoDB table to grant read/write access to the Next.js server function
   */
  table?: dynamodb.ITable;
  /**
   * Override the default hosted zone
   * @default CDK_ENV_HOSTED_ZONE or "jaypie.net"
   */
  zone?: string;
}

export class GardenNextjsStack extends JaypieAppStack {
  public readonly nextjs: JaypieNextJs;

  constructor(
    scope: Construct,
    id?: string,
    props: GardenNextjsStackProps = {},
  ) {
    super(scope, id ?? "JaypieGardenNextjsStack", { key: "garden-nextjs" });

    const zone = props.zone ?? process.env.CDK_ENV_HOSTED_ZONE ?? DEFAULT_ZONE;
    const host =
      props.host ?? envHostname({ domain: zone, subdomain: "garden" });

    this.nextjs = new JaypieNextJs(this, "GardenNextjs", {
      domainName: host,
      hostedZone: zone,
      nextjsPath: "../garden-nextjs",
      ...(props.table ? { tables: [props.table] } : {}),
    });
  }
}
