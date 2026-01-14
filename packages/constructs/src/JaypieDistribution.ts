import { Duration, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";

import { CDK } from "./constants";
import {
  constructEnvName,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  resolveCertificate,
  resolveHostedZone,
} from "./helpers";
import { resolveDatadogForwarderFunction } from "./helpers/resolveDatadogForwarderFunction";

export interface JaypieDistributionProps extends Omit<
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
   * Log destination configuration for CloudFront access logs
   * - LambdaDestination: Use a specific Lambda destination for S3 notifications
   * - true: Use Datadog forwarder for S3 notifications (default)
   * - false: Disable logging entirely
   * @default true
   */
  destination?: LambdaDestination | boolean;
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
   * Invoke mode for Lambda Function URLs.
   * If not provided, auto-detects from handler if it has an invokeMode property
   * (e.g., JaypieStreamingLambda).
   * @default InvokeMode.BUFFERED (or auto-detected from handler)
   */
  invokeMode?: lambda.InvokeMode;
  /**
   * Origin read timeout - how long CloudFront waits for a response from the origin.
   * This is the maximum time allowed for the origin to respond.
   * @default CDK.DURATION.CLOUDFRONT_API (120 seconds)
   * @max Duration.seconds(120)
   */
  originReadTimeout?: Duration;
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
  public readonly logBucket?: s3.IBucket;

  constructor(scope: Construct, id: string, props: JaypieDistributionProps) {
    super(scope, id);

    const {
      certificate: certificateProp = true,
      defaultBehavior: propsDefaultBehavior,
      destination: destinationProp = true,
      handler,
      host: propsHost,
      invokeMode = lambda.InvokeMode.BUFFERED,
      originReadTimeout = Duration.seconds(CDK.DURATION.CLOUDFRONT_API),
      roleTag = CDK.ROLE.API,
      zone: propsZone,
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
      // Auto-detect invoke mode from handler (e.g., JaypieStreamingLambda)
      // Explicit invokeMode prop takes precedence over auto-detection
      const resolvedInvokeMode =
        invokeMode !== lambda.InvokeMode.BUFFERED
          ? invokeMode // Explicit non-default value, use it
          : this.hasInvokeMode(handler)
            ? handler.invokeMode // Auto-detect from handler
            : invokeMode; // Use default BUFFERED

      if (this.isIFunction(handler)) {
        // Create FunctionUrl for the Lambda function
        const functionUrl = new lambda.FunctionUrl(this, "FunctionUrl", {
          function: handler,
          authType: lambda.FunctionUrlAuthType.NONE,
          invokeMode: resolvedInvokeMode,
        });
        this.functionUrl = functionUrl;
        origin = new origins.FunctionUrlOrigin(functionUrl, {
          readTimeout: originReadTimeout,
        });
      } else if (this.isIFunctionUrl(handler)) {
        origin = new origins.FunctionUrlOrigin(handler, {
          readTimeout: originReadTimeout,
        });
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
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
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

      // Use resolveCertificate to create certificate at stack level (enables reuse when swapping constructs)
      certificateToUse = resolveCertificate(this, {
        certificate: certificateProp,
        domainName: host,
        roleTag,
        zone: hostedZone,
      });

      this.certificate = certificateToUse;
    }

    // Create log bucket if logging is enabled
    let logBucket: s3.Bucket | undefined;
    if (destinationProp !== false) {
      logBucket = new s3.Bucket(this, constructEnvName("LogBucket"), {
        objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        lifecycleRules: [
          {
            expiration: Duration.days(90),
            transitions: [
              {
                storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                transitionAfter: Duration.days(30),
              },
            ],
          },
        ],
      });
      Tags.of(logBucket).add(CDK.TAG.ROLE, CDK.ROLE.STORAGE);

      // Add S3 notification to Datadog forwarder
      const lambdaDestination =
        destinationProp === true
          ? new LambdaDestination(resolveDatadogForwarderFunction(this))
          : destinationProp;

      logBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        lambdaDestination,
      );

      this.logBucket = logBucket;
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
        ...(logBucket
          ? {
              enableLogging: true,
              logBucket,
              logFilePrefix: "cloudfront-logs/",
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

  private hasInvokeMode(
    handler: unknown,
  ): handler is { invokeMode: lambda.InvokeMode } {
    // Check if handler has an invokeMode property (e.g., JaypieStreamingLambda)
    return (
      typeof handler === "object" &&
      handler !== null &&
      "invokeMode" in handler &&
      typeof (handler as { invokeMode: unknown }).invokeMode === "string"
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
