import { RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";

import { CDK } from "./constants";
import {
  constructEnvName,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  resolveHostedZone,
} from "./helpers";

export interface JaypieDistributionProps
  extends Omit<
    cloudfront.DistributionProps,
    "certificate" | "defaultBehavior"
  > {
  /**
   * SSL certificate for the CloudFront distribution
   * @default true (creates a new certificate)
   */
  certificate?: boolean | acm.ICertificate;
  /**
   * Override default behavior (optional if handler is provided)
   */
  defaultBehavior?: cloudfront.BehaviorOptions;
  /**
   * The origin handler - can be an IOrigin, IFunctionUrl, or IFunction
   * If IFunction, a FunctionUrl will be created with auth NONE
   */
  handler?: cloudfront.IOrigin | lambda.IFunctionUrl | lambda.IFunction;
  /**
   * The domain name for the distribution
   * @default mergeDomain(CDK_ENV_API_SUBDOMAIN, CDK_ENV_API_HOSTED_ZONE || CDK_ENV_HOSTED_ZONE)
   */
  host?: string;
  /**
   * Invoke mode for Lambda Function URLs
   * @default InvokeMode.BUFFERED
   */
  invokeMode?: lambda.InvokeMode;
  /**
   * Role tag for tagging resources
   * @default CDK.ROLE.HOSTING
   */
  roleTag?: string;
  /**
   * The hosted zone for DNS records
   * @default CDK_ENV_API_HOSTED_ZONE || CDK_ENV_HOSTED_ZONE
   */
  zone?: string | route53.IHostedZone;
}

export class JaypieDistribution
  extends Construct
  implements cloudfront.IDistribution
{
  public readonly certificate?: acm.ICertificate;
  public readonly distribution: cloudfront.Distribution;
  public readonly distributionArn: string;
  public readonly distributionDomainName: string;
  public readonly distributionId: string;
  public readonly domainName: string;
  public readonly functionUrl?: lambda.FunctionUrl;
  public readonly host?: string;

  constructor(scope: Construct, id: string, props: JaypieDistributionProps) {
    super(scope, id);

    const {
      certificate: certificateProp = true,
      handler,
      host: propsHost,
      invokeMode = lambda.InvokeMode.BUFFERED,
      roleTag = CDK.ROLE.API,
      zone: propsZone,
      defaultBehavior: propsDefaultBehavior,
      ...distributionProps
    } = props;

    // Validate environment variables
    if (
      process.env.CDK_ENV_API_SUBDOMAIN &&
      !isValidSubdomain(process.env.CDK_ENV_API_SUBDOMAIN)
    ) {
      throw new Error("CDK_ENV_API_SUBDOMAIN is not a valid subdomain");
    }

    if (
      process.env.CDK_ENV_API_HOSTED_ZONE &&
      !isValidHostname(process.env.CDK_ENV_API_HOSTED_ZONE)
    ) {
      throw new Error("CDK_ENV_API_HOSTED_ZONE is not a valid hostname");
    }

    if (
      process.env.CDK_ENV_HOSTED_ZONE &&
      !isValidHostname(process.env.CDK_ENV_HOSTED_ZONE)
    ) {
      throw new Error("CDK_ENV_HOSTED_ZONE is not a valid hostname");
    }

    // Determine host from props or environment
    let host = propsHost;
    if (!host) {
      try {
        if (process.env.CDK_ENV_API_HOST_NAME) {
          host = process.env.CDK_ENV_API_HOST_NAME;
        } else if (process.env.CDK_ENV_API_SUBDOMAIN) {
          host = mergeDomain(
            process.env.CDK_ENV_API_SUBDOMAIN,
            process.env.CDK_ENV_API_HOSTED_ZONE ||
              process.env.CDK_ENV_HOSTED_ZONE ||
              "",
          );
        }
      } catch {
        host = undefined;
      }
    }

    if (host && !isValidHostname(host)) {
      throw new Error("Host is not a valid hostname");
    }

    this.host = host;

    // Determine zone from props or environment
    const zone = propsZone || process.env.CDK_ENV_HOSTED_ZONE;

    // Resolve the origin from handler
    // Check order matters: IFunctionUrl before IOrigin (FunctionUrl also has bind method)
    // IFunction before IFunctionUrl (IFunction doesn't have functionUrlId)
    let origin: cloudfront.IOrigin | undefined;
    if (handler) {
      if (this.isIFunction(handler)) {
        // Create FunctionUrl for the Lambda function
        const functionUrl = new lambda.FunctionUrl(this, "FunctionUrl", {
          function: handler,
          authType: lambda.FunctionUrlAuthType.NONE,
          invokeMode,
        });
        this.functionUrl = functionUrl;
        origin = new origins.FunctionUrlOrigin(functionUrl);
      } else if (this.isIFunctionUrl(handler)) {
        origin = new origins.FunctionUrlOrigin(handler);
      } else if (this.isIOrigin(handler)) {
        origin = handler;
      }
    }

    // Build default behavior
    let defaultBehavior: cloudfront.BehaviorOptions;
    if (propsDefaultBehavior) {
      defaultBehavior = propsDefaultBehavior;
    } else if (origin) {
      defaultBehavior = {
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        origin,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      };
    } else {
      throw new Error(
        "Either handler or defaultBehavior must be provided to JaypieDistribution",
      );
    }

    // Resolve hosted zone and certificate
    // Only resolve zone when we need it (for certificate or DNS)
    let hostedZone: route53.IHostedZone | undefined;
    let certificateToUse: acm.ICertificate | undefined;

    if (host && zone && certificateProp !== false) {
      hostedZone = resolveHostedZone(this, { zone });

      if (certificateProp === true) {
        certificateToUse = new acm.Certificate(
          this,
          constructEnvName("Certificate"),
          {
            domainName: host,
            validation: acm.CertificateValidation.fromDns(hostedZone),
          },
        );
        Tags.of(certificateToUse).add(CDK.TAG.ROLE, roleTag);
      } else if (typeof certificateProp === "object") {
        certificateToUse = certificateProp;
      }

      this.certificate = certificateToUse;
    }

    // Create the CloudFront distribution
    this.distribution = new cloudfront.Distribution(
      this,
      constructEnvName("Distribution"),
      {
        defaultBehavior,
        ...(host && certificateToUse
          ? {
              certificate: certificateToUse,
              domainNames: [host],
            }
          : {}),
        ...distributionProps,
      },
    );
    Tags.of(this.distribution).add(CDK.TAG.ROLE, roleTag);

    this.distributionArn = `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${this.distribution.distributionId}`;
    this.distributionDomainName = this.distribution.distributionDomainName;
    this.distributionId = this.distribution.distributionId;
    this.domainName = this.distribution.domainName;

    // Create DNS records if we have host and zone
    if (host && hostedZone) {
      const aRecord = new route53.ARecord(this, "AliasRecord", {
        recordName: host,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
        zone: hostedZone,
      });
      Tags.of(aRecord).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);

      const aaaaRecord = new route53.AaaaRecord(this, "AaaaAliasRecord", {
        recordName: host,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
        zone: hostedZone,
      });
      Tags.of(aaaaRecord).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
    }
  }

  // Type guards for handler types
  private isIOrigin(handler: unknown): handler is cloudfront.IOrigin {
    return (
      typeof handler === "object" &&
      handler !== null &&
      "bind" in handler &&
      typeof (handler as cloudfront.IOrigin).bind === "function"
    );
  }

  private isIFunctionUrl(handler: unknown): handler is lambda.IFunctionUrl {
    // FunctionUrl has 'url' property which is the function URL string
    // IFunction does not have 'url' property
    return (
      typeof handler === "object" &&
      handler !== null &&
      "url" in handler &&
      "functionArn" in handler
    );
  }

  private isIFunction(handler: unknown): handler is lambda.IFunction {
    // IFunction has functionArn and functionName but NOT 'url'
    // (FunctionUrl also has functionArn but also has 'url')
    return (
      typeof handler === "object" &&
      handler !== null &&
      "functionArn" in handler &&
      "functionName" in handler &&
      !("url" in handler)
    );
  }

  // Implement IDistribution interface
  public get env() {
    return {
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    };
  }

  public get stack(): Stack {
    return this.distribution.stack;
  }

  public applyRemovalPolicy(policy: RemovalPolicy): void {
    this.distribution.applyRemovalPolicy(policy);
  }

  public grant(
    identity: import("aws-cdk-lib/aws-iam").IGrantable,
    ...actions: string[]
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this.distribution.grant(identity, ...actions);
  }

  public grantCreateInvalidation(
    identity: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this.distribution.grantCreateInvalidation(identity);
  }

  public get distributionRef(): cloudfront.DistributionReference {
    return {
      distributionId: this.distribution.distributionId,
    };
  }
}
