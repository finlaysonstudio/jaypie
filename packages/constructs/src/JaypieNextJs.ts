import { IHostedZone } from "aws-cdk-lib/aws-route53";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Nextjs } from "cdk-nextjs-standalone";
import { Construct } from "constructs";
import * as path from "path";

import {
  addDatadogLayers,
  envHostname,
  EnvironmentInput,
  jaypieLambdaEnv,
  resolveEnvironment,
  resolveHostedZone,
  resolveParamsAndSecrets,
  resolveSecrets,
  SecretsArrayItem,
} from "./helpers";

export interface DomainNameConfig {
  component?: string;
  domain?: string;
  env?: string;
  subdomain?: string;
}

export interface JaypieNextjsProps {
  datadogApiKeyArn?: string;
  /**
   * Domain name for the Next.js application.
   *
   * Supports both string and config object:
   * - String: used directly as the domain name
   * - Object: passed to envHostname() to construct the domain name
   *   - { component, domain, env, subdomain }
   */
  domainName?: string | DomainNameConfig;
  /**
   * Environment variables for the Next.js application.
   *
   * Supports both legacy object syntax and new array syntax:
   * - Object: { KEY: "value" } - directly sets environment variables
   * - Array: ["KEY1", "KEY2", { KEY3: "value" }]
   *   - Strings: lookup value from process.env
   *   - Objects: merge key-value pairs directly
   */
  environment?: EnvironmentInput;
  envSecrets?: { [key: string]: secretsmanager.ISecret };
  hostedZone?: IHostedZone | string;
  nextjsPath?: string;
  /**
   * Secrets to make available to the Next.js application.
   *
   * Supports both JaypieEnvSecret instances and strings:
   * - JaypieEnvSecret: used directly
   * - String: creates a JaypieEnvSecret with the string as envKey
   *   (reuses existing secrets within the same scope)
   */
  secrets?: SecretsArrayItem[];
}

export class JaypieNextJs extends Construct {
  public readonly domainName: string;

  constructor(scope: Construct, id: string, props?: JaypieNextjsProps) {
    super(scope, id);

    const domainName =
      typeof props?.domainName === "string"
        ? props.domainName
        : envHostname(props?.domainName);
    this.domainName = domainName;
    const domainNameSanitized = domainName
      .replace(/\./g, "-")
      .replace(/[^a-zA-Z0-9]/g, "_");

    // Resolve environment from array or object syntax
    const environment = resolveEnvironment(props?.environment);
    const envSecrets = props?.envSecrets || {};
    const nextjsPath = props?.nextjsPath?.startsWith("..")
      ? path.join(process.cwd(), props.nextjsPath)
      : props?.nextjsPath || path.join(process.cwd(), "..", "nextjs");
    const paramsAndSecrets = resolveParamsAndSecrets();

    // Resolve secrets from mixed array (strings and JaypieEnvSecret instances)
    const secrets = resolveSecrets(scope, props?.secrets);

    // Process secrets environment variables
    const secretsEnvironment = Object.entries(envSecrets).reduce(
      (acc, [key, secret]) => ({
        ...acc,
        [`SECRET_${key}`]: secret.secretName,
      }),
      {},
    );

    // Process JaypieEnvSecret array
    const jaypieSecretsEnvironment = secrets.reduce<{ [key: string]: string }>(
      (acc, secret) => {
        if (secret.envKey) {
          return {
            ...acc,
            [`SECRET_${secret.envKey}`]: secret.secretName,
          };
        }
        return acc;
      },
      {},
    );

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
