import {
  envHostname,
  jaypieLambdaEnv,
  resolveHostedZone,
} from "@jaypie/constructs";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Nextjs } from "cdk-nextjs-standalone";
import { Construct } from "constructs";
import * as path from "path";

import { addDatadogLayers, resolveParamsAndSecrets } from "./helpers";
import { JaypieEnvSecret } from "./JaypieEnvSecret.js";

export interface JaypieNextjsProps {
  datadogApiKeyArn?: string;
  domainName?: string;
  envSecrets?: { [key: string]: secretsmanager.ISecret };
  hostedZone?: IHostedZone | string;
  nextjsPath?: string;
  secrets?: JaypieEnvSecret[];
}

export class JaypieNextJs extends Construct {
  constructor(scope: Construct, id: string, props?: JaypieNextjsProps) {
    super(scope, id);

    const domainName = props?.domainName || envHostname();
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
        ...secretsEnvironment,
        ...jaypieSecretsEnvironment,
      },
      overrides: {
        nextjsServer: {
          functionProps: {
            paramsAndSecrets,
          },
        },
        nextjsImage: {
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
