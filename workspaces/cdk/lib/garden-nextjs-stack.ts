import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import {
  envHostname,
  JaypieAppStack,
  JaypieEnvSecret,
  JaypieNextJs,
} from "@jaypie/constructs";

const DEFAULT_ZONE = "jaypie.net";

export interface GardenNextjsStackProps {
  /**
   * AUTH0_SECRET from the data stack
   */
  auth0Secret?: JaypieEnvSecret;
  /**
   * Override the default host for the garden site
   * @default envHostname({ subdomain: "garden" }) - e.g., "garden.jaypie.net" for production
   */
  host?: string;
  /**
   * PROJECT_SALT secret from the data stack
   */
  salt?: JaypieEnvSecret;
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

    const auth0Secret =
      props.auth0Secret ??
      new JaypieEnvSecret(this, "Auth0Secret", {
        envKey: "AUTH0_SECRET",
        generateSecretString: {
          excludePunctuation: true,
          includeSpace: false,
          passwordLength: 64,
        },
      });

    const projectSalt =
      props.salt ??
      new JaypieEnvSecret(this, "ProjectSalt", {
        envKey: "PROJECT_SALT",
        generateSecretString: {
          excludePunctuation: true,
          includeSpace: false,
          passwordLength: 64,
        },
      });

    this.nextjs = new JaypieNextJs(this, "GardenNextjs", {
      domainName: host,
      environment: [
        "AUTH0_CLIENT_ID",
        "AUTH0_CLIENT_SECRET",
        "AUTH0_DOMAIN",
      ],
      hostedZone: zone,
      nextjsPath: "../garden-ui",
      secrets: [auth0Secret, projectSalt],
      ...(props.table ? { tables: [props.table] } : {}),
    });
  }
}
