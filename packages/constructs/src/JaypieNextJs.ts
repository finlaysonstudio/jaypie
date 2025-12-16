import { IHostedZone } from "aws-cdk-lib/aws-route53";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Nextjs } from "cdk-nextjs-standalone";
import { Construct } from "constructs";
import * as path from "path";

import {
  addDatadogLayers,
  envHostname,
  jaypieLambdaEnv,
  resolveHostedZone,
  resolveParamsAndSecrets,
} from "./helpers";
import { JaypieEnvSecret } from "./JaypieEnvSecret.js";

export interface JaypieNextjsProps {
  datadogApiKeyArn?: string;
  domainName?: string;
  environment?: { [key: string]: string };
  envSecrets?: { [key: string]: secretsmanager.ISecret };
  hostedZone?: IHostedZone | string;
  nextjsPath?: string;
  secrets?: JaypieEnvSecret[];
}

export class JaypieNextJs extends Construct {
  public readonly domainName: string;

  constructor(scope: Construct, id: string, props?: JaypieNextjsProps) {
    super(scope, id);

    const domainName = props?.domainName || envHostname();
    this.domainName = domainName;
    const domainNameSanitized = domainName
      .replace(/\./g, "-")
      .replace(/[^a-zA-Z0-9]/g, "_");
    const environment = props?.environment || {};
    const envSecrets = props?.envSecrets || {};
    const nextjsPath = props?.nextjsPath?.startsWith("..")
      ? path.join(process.cwd(), props.nextjsPath)
      : props?.nextjsPath || path.join(process.cwd(), "..", "nextjs");
    const paramsAndSecrets = resolveParamsAndSecrets();
    const secrets = props?.secrets || [];

    // Process secrets environment variables
    const secretsEnvironment = Object.entries(envSecrets).reduce(
      (acc, [key, secret]) => ({
        ...acc,
        [`SECRET_${key}`]: secret.secretName,
      }),
      {},
    );

    // Process JaypieEnvSecret array
    const jaypieSecretsEnvironment = secrets.reduce((acc, secret) => {
      if (secret.envKey) {
        return {
          ...acc,
          [`SECRET_${secret.envKey}`]: secret.secretName,
        };
      }
      return acc;
    }, {});

    // Process NEXT_PUBLIC_ environment variables
    const nextPublicEnv = Object.entries(process.env).reduce(
      (acc, [key, value]) => {
        if (key.startsWith("NEXT_PUBLIC_") && value) {
          return {
            ...acc,
            [key]: value,
          };
        }
        return acc;
      },
      {},
    );

    const nextjs = new Nextjs(this, "NextJsApp", {
      nextjsPath,
      domainProps: {
        domainName,
        hostedZone: resolveHostedZone(this, {
          zone: props?.hostedZone,
        }),
      },
      environment: {
        ...jaypieLambdaEnv(),
        ...environment,
        ...secretsEnvironment,
        ...jaypieSecretsEnvironment,
        ...nextPublicEnv,
        NEXT_PUBLIC_SITE_URL: `https://${domainName}`,
      },
      overrides: {
        nextjsDistribution: {
          imageCachePolicyProps: {
            cachePolicyName: `NextJsImageCachePolicy-${domainNameSanitized}`,
          },
          serverCachePolicyProps: {
            cachePolicyName: `NextJsServerCachePolicy-${domainNameSanitized}`,
          },
        },
        nextjsImage: {
          functionProps: {
            paramsAndSecrets,
          },
        },
        nextjsServer: {
          functionProps: {
            paramsAndSecrets,
          },
        },
      },
    });

    addDatadogLayers(nextjs.imageOptimizationFunction);
    addDatadogLayers(nextjs.serverFunction.lambdaFunction);

    // Grant secret read permissions
    Object.values(envSecrets).forEach((secret) => {
      secret.grantRead(nextjs.serverFunction.lambdaFunction);
    });

    // Grant read permissions for JaypieEnvSecrets
    secrets.forEach((secret) => {
      secret.grantRead(nextjs.serverFunction.lambdaFunction);
    });
  }
}
