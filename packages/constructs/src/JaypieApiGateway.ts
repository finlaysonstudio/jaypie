import { Construct } from "constructs";
import { RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apiGateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import { CDK } from "./constants";
import {
  constructEnvName,
  envHostname,
  HostConfig,
  mergeDomain,
  resolveCertificate,
  resolveHostedZone,
} from "./helpers";

export interface JaypieApiGatewayProps extends apiGateway.LambdaRestApiProps {
  certificate?: boolean | acm.ICertificate;
  /**
   * The domain name for the API Gateway.
   *
   * Supports both string and config object:
   * - String: used directly as the domain name (e.g., "api.example.com")
   * - Object: passed to envHostname() to construct the domain name
   *   - { subdomain, domain, env, component }
   *
   * @example
   * // Direct string
   * host: "api.example.com"
   *
   * @example
   * // Config object - resolves using envHostname()
   * host: { subdomain: "api" }
   */
  host?: string | HostConfig;
  name?: string;
  roleTag?: string;
  zone?: string | route53.IHostedZone;
}

export class JaypieApiGateway extends Construct implements apiGateway.IRestApi {
  private readonly _api: apiGateway.LambdaRestApi;
  private readonly _certificate?: acm.ICertificate;
  private readonly _domainName?: apiGateway.DomainName;
  private readonly _host?: string;

  constructor(scope: Construct, id: string, props: JaypieApiGatewayProps) {
    super(scope, id);

    const {
      certificate = true,
      handler,
      host: propsHost,
      name,
      roleTag = CDK.ROLE.API,
      zone: propsZone,
    } = props;

    // Determine zone from props or environment
    let zone = propsZone;
    if (!zone && process.env.CDK_ENV_API_HOSTED_ZONE) {
      zone = process.env.CDK_ENV_API_HOSTED_ZONE;
    }

    // Determine host from props or environment
    let host: string | undefined;
    if (typeof propsHost === "string") {
      host = propsHost;
    } else if (typeof propsHost === "object") {
      // Resolve host from HostConfig using envHostname()
      host = envHostname(propsHost);
    } else if (process.env.CDK_ENV_API_HOST_NAME) {
      host = process.env.CDK_ENV_API_HOST_NAME;
    } else if (
      process.env.CDK_ENV_API_SUBDOMAIN &&
      process.env.CDK_ENV_API_HOSTED_ZONE
    ) {
      host = mergeDomain(
        process.env.CDK_ENV_API_SUBDOMAIN,
        process.env.CDK_ENV_API_HOSTED_ZONE,
      );
    }

    // Set PROJECT_BASE_URL on the Lambda if host is resolved and handler supports it
    if (host && "addEnvironment" in handler) {
      (handler as lambda.Function).addEnvironment(
        "PROJECT_BASE_URL",
        `https://${host}`,
      );
    }

    const apiGatewayName = name || constructEnvName("ApiGateway");
    const apiDomainName = constructEnvName("ApiDomainName");

    let hostedZone: route53.IHostedZone | undefined;
    let certificateToUse: acm.ICertificate | undefined;

    if (host && zone) {
      hostedZone = resolveHostedZone(this, { zone });

      // Use resolveCertificate to create certificate at stack level (enables reuse when swapping constructs)
      certificateToUse = resolveCertificate(this, {
        certificate,
        domainName: host,
        roleTag: CDK.ROLE.HOSTING,
        zone: hostedZone,
      });

      this._certificate = certificateToUse;
      this._host = host;
    }

    const {
      // * `...lambdaRestApiProps` cannot be moved to the first const destructuring because it needs to exclude the custom properties first.
      // Ignore the variables we already assigned to other properties
      /* eslint-disable @typescript-eslint/no-unused-vars */
      certificate: _certificate,
      host: _host,
      name: _name,
      roleTag: _roleTag,
      zone: _zone,
      handler: _handler,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...lambdaRestApiProps
    } = props;

    this._api = new apiGateway.LambdaRestApi(this, apiGatewayName, {
      handler,
      ...lambdaRestApiProps,
    });
    Tags.of(this._api).add(CDK.TAG.ROLE, roleTag);

    if (host && certificateToUse && hostedZone) {
      this._domainName = this._api.addDomainName(apiDomainName, {
        domainName: host,
        certificate: certificateToUse,
      });
      Tags.of(this._domainName).add(CDK.TAG.ROLE, roleTag);

      const record = new route53.ARecord(this, "AliasRecord", {
        recordName: host,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayDomain(this._domainName),
        ),
        zone: hostedZone,
      });
      Tags.of(record).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
    }
  }

  public get api(): apiGateway.LambdaRestApi {
    return this._api;
  }

  public get url(): string {
    return this._api.url;
  }

  public get certificateArn(): string | undefined {
    return this._certificate?.certificateArn;
  }

  public get domainName(): string | undefined {
    return this._domainName?.domainName;
  }

  public get host(): string | undefined {
    return this._host;
  }

  public get restApiId(): string {
    return this._api.restApiId;
  }

  public get restApiName(): string {
    return this._api.restApiName;
  }

  public get restApiRootResourceId(): string {
    return this._api.restApiRootResourceId;
  }

  public get deploymentStage(): apiGateway.Stage {
    return this._api.deploymentStage;
  }

  public get domainNameAliasDomainName(): string | undefined {
    return this._domainName?.domainNameAliasDomainName;
  }

  public get domainNameAliasHostedZoneId(): string | undefined {
    return this._domainName?.domainNameAliasHostedZoneId;
  }

  public get root(): apiGateway.IResource {
    return this._api.root;
  }

  public get env() {
    return {
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    };
  }

  public get stack(): Stack {
    return this._api.stack;
  }

  public arnForExecuteApi(
    method?: string,
    path?: string,
    stage?: string,
  ): string {
    return this._api.arnForExecuteApi(method, path, stage);
  }

  public metric(
    metricName: string,
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._api.metric(metricName, props);
  }

  public metricCacheHitCount(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._api.metricCacheHitCount(props);
  }

  public metricCacheMissCount(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._api.metricCacheMissCount(props);
  }

  public metricClientError(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._api.metricClientError(props);
  }

  public metricCount(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._api.metricCount(props);
  }

  public metricIntegrationLatency(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._api.metricIntegrationLatency(props);
  }

  public metricLatency(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._api.metricLatency(props);
  }

  public metricServerError(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._api.metricServerError(props);
  }

  public applyRemovalPolicy(policy: RemovalPolicy): void {
    this._api.applyRemovalPolicy(policy);
  }

  public get restApiRef(): apiGateway.RestApiReference {
    return {
      restApiId: this._api.restApiId,
    };
  }
}
