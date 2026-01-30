import { Duration, Fn, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
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
  envHostname,
  HostConfig,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  resolveCertificate,
  resolveHostedZone,
} from "./helpers";
import { resolveDatadogForwarderFunction } from "./helpers/resolveDatadogForwarderFunction";

export interface JaypieDistributionProps extends Omit<
  cloudfront.DistributionProps,
  "certificate" | "defaultBehavior" | "logBucket"
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
   * - false: Disable S3 notifications (logging still occurs if logBucket is set)
   * @default true
   */
  destination?: LambdaDestination | boolean;
  /**
   * External log bucket for CloudFront access logs.
   * - IBucket: Use existing bucket directly
   * - string: Bucket name to import
   * - { exportName: string }: CloudFormation export name to import
   * - true: Use account logging bucket (CDK.IMPORT.LOG_BUCKET)
   * @default undefined (creates new bucket if destination !== false)
   */
  logBucket?: s3.IBucket | string | { exportName: string } | true;
  /**
   * The origin handler - can be an IOrigin, IFunctionUrl, or IFunction
   * If IFunction, a FunctionUrl will be created with auth NONE
   */
  handler?: cloudfront.IOrigin | lambda.IFunctionUrl | lambda.IFunction;
  /**
   * The domain name for the distribution.
   *
   * Supports both string and config object:
   * - String: used directly as the domain name (e.g., "api.example.com")
   * - Object: passed to envHostname() to construct the domain name
   *   - { subdomain, domain, env, component }
   *
   * @default mergeDomain(CDK_ENV_API_SUBDOMAIN, CDK_ENV_API_HOSTED_ZONE || CDK_ENV_HOSTED_ZONE)
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
  /**
   * Enable response streaming for Lambda Function URLs.
   * Use with createLambdaStreamHandler for SSE/streaming responses.
   * @default false
   */
  streaming?: boolean;
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
      logBucket: logBucketProp,
      originReadTimeout = Duration.seconds(CDK.DURATION.CLOUDFRONT_API),
      roleTag = CDK.ROLE.API,
      streaming = false,
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
    let host: string | undefined;
    if (typeof propsHost === "string") {
      host = propsHost;
    } else if (typeof propsHost === "object") {
      // Resolve host from HostConfig using envHostname()
      try {
        host = envHostname(propsHost);
      } catch {
        host = undefined;
      }
    } else {
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
      const resolvedInvokeMode = streaming
        ? lambda.InvokeMode.RESPONSE_STREAM
        : lambda.InvokeMode.BUFFERED;

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

      // Set PROJECT_BASE_URL on the Lambda if host is resolved and handler supports it
      if (host && this.isIFunction(handler) && "addEnvironment" in handler) {
        (handler as lambda.Function).addEnvironment(
          "PROJECT_BASE_URL",
          `https://${host}`,
        );
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

    // Resolve or create log bucket
    let logBucket: s3.IBucket | undefined;
    const isExternalBucket = logBucketProp !== undefined;

    if (logBucketProp !== undefined) {
      // Use external bucket
      logBucket = this.resolveLogBucket(logBucketProp);
    } else if (destinationProp !== false) {
      // Create new bucket (original behavior)
      const createdBucket = new s3.Bucket(this, constructEnvName("LogBucket"), {
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
        objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
        removalPolicy: RemovalPolicy.DESTROY,
      });
      Tags.of(createdBucket).add(CDK.TAG.ROLE, CDK.ROLE.STORAGE);
      logBucket = createdBucket;
    }

    // Add S3 notifications if we have a bucket and destination is not false
    if (logBucket && destinationProp !== false && !isExternalBucket) {
      // Only add notifications to buckets we created (not external buckets)
      const lambdaDestination =
        destinationProp === true
          ? new LambdaDestination(resolveDatadogForwarderFunction(this))
          : destinationProp;

      (logBucket as s3.Bucket).addEventNotification(
        s3.EventType.OBJECT_CREATED,
        lambdaDestination,
      );
    }

    this.logBucket = logBucket;

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

  private isExportNameObject(value: unknown): value is { exportName: string } {
    return (
      typeof value === "object" &&
      value !== null &&
      "exportName" in value &&
      typeof (value as { exportName: string }).exportName === "string"
    );
  }

  private resolveLogBucket(
    logBucketProp: s3.IBucket | string | { exportName: string } | true,
  ): s3.IBucket {
    // true = use account logging bucket
    if (logBucketProp === true) {
      const bucketName = Fn.importValue(CDK.IMPORT.LOG_BUCKET);
      return s3.Bucket.fromBucketName(this, "ImportedLogBucket", bucketName);
    }

    // { exportName: string } = import from CloudFormation export
    if (this.isExportNameObject(logBucketProp)) {
      const bucketName = Fn.importValue(logBucketProp.exportName);
      return s3.Bucket.fromBucketName(this, "ImportedLogBucket", bucketName);
    }

    // string = bucket name
    if (typeof logBucketProp === "string") {
      return s3.Bucket.fromBucketName(this, "ImportedLogBucket", logBucketProp);
    }

    // IBucket = use directly
    return logBucketProp;
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
