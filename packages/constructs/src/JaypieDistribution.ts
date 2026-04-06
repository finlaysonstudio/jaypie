import { Duration, Fn, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
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

const DEFAULT_RATE_LIMIT = 2000;

const DEFAULT_MANAGED_RULES = [
  "AWSManagedRulesCommonRuleSet",
  "AWSManagedRulesKnownBadInputsRuleSet",
];

export interface JaypieWafConfig {
  /**
   * Whether WAF is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * WAF logging bucket.
   * - true/undefined: create a logging bucket with Datadog forwarding (default)
   * - false: disable WAF logging
   * - IBucket: use an existing bucket (must have "aws-waf-logs-" prefix)
   * @default true
   */
  logBucket?: boolean | s3.IBucket;

  /**
   * Override actions for specific rules within managed rule groups.
   * Key is the managed rule group name; value is an array of rule action overrides.
   * @example
   * managedRuleOverrides: {
   *   AWSManagedRulesCommonRuleSet: [
   *     { name: "SizeRestrictions_BODY", actionToUse: { count: {} } },
   *   ],
   * }
   */
  managedRuleOverrides?: Record<
    string,
    wafv2.CfnWebACL.RuleActionOverrideProperty[]
  >;

  /**
   * Managed rule group names to apply
   * @default ["AWSManagedRulesCommonRuleSet", "AWSManagedRulesKnownBadInputsRuleSet"]
   */
  managedRules?: string[];

  /**
   * Rate limit per IP per 5-minute window
   * @default 2000
   */
  rateLimitPerIp?: number;

  /**
   * Use an existing WebACL ARN instead of creating one
   */
  webAclArn?: string;
}

export interface SecurityHeadersOverrides {
  contentSecurityPolicy?: string;
  frameOption?: cloudfront.HeadersFrameOption;
  hstsIncludeSubdomains?: boolean;
  hstsMaxAge?: number;
  permissionsPolicy?: string;
  referrerPolicy?: cloudfront.HeadersReferrerPolicy;
}

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
   * Full override for the response headers policy.
   * When provided, bypasses all default security header logic.
   */
  responseHeadersPolicy?: cloudfront.IResponseHeadersPolicy;
  /**
   * Security headers configuration.
   * - true/undefined: apply sensible defaults (HSTS, X-Frame-Options, CSP, etc.)
   * - false: disable security headers entirely
   * - SecurityHeadersOverrides object: merge overrides with defaults
   * @default true
   */
  securityHeaders?: boolean | SecurityHeadersOverrides;
  /**
   * Role tag for tagging resources
   * @default CDK.ROLE.HOSTING
   */
  roleTag?: string;
  /**
   * WAF WebACL configuration for the CloudFront distribution.
   * - true/undefined: create and attach a WebACL with sensible defaults
   * - false: disable WAF
   * - JaypieWafConfig: customize WAF behavior
   * @default true
   */
  waf?: boolean | JaypieWafConfig;
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
  public readonly responseHeadersPolicy?: cloudfront.IResponseHeadersPolicy;
  public readonly wafLogBucket?: s3.IBucket;
  public readonly webAcl?: wafv2.CfnWebACL;

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
      responseHeadersPolicy: responseHeadersPolicyProp,
      roleTag = CDK.ROLE.API,
      securityHeaders: securityHeadersProp,
      streaming = false,
      waf: wafProp = true,
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

    // Resolve response headers policy for security headers
    let resolvedResponseHeadersPolicy:
      | cloudfront.IResponseHeadersPolicy
      | undefined;
    if (responseHeadersPolicyProp) {
      resolvedResponseHeadersPolicy = responseHeadersPolicyProp;
    } else if (securityHeadersProp !== false) {
      const overrides =
        typeof securityHeadersProp === "object" ? securityHeadersProp : {};
      resolvedResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
        this,
        "SecurityHeaders",
        {
          customHeadersBehavior: {
            customHeaders: [
              {
                header: "Cache-Control",
                override: true,
                value: "no-store, no-cache, must-revalidate, proxy-revalidate",
              },
              {
                header: "Cross-Origin-Embedder-Policy",
                override: true,
                value: "unsafe-none",
              },
              {
                header: "Cross-Origin-Opener-Policy",
                override: true,
                value: "same-origin",
              },
              {
                header: "Cross-Origin-Resource-Policy",
                override: true,
                value: "same-origin",
              },
              {
                header: "Permissions-Policy",
                override: true,
                value:
                  overrides.permissionsPolicy ??
                  CDK.SECURITY_HEADERS.PERMISSIONS_POLICY,
              },
            ],
          },
          removeHeaders: ["Server"],
          securityHeadersBehavior: {
            contentSecurityPolicy: {
              contentSecurityPolicy:
                overrides.contentSecurityPolicy ??
                CDK.SECURITY_HEADERS.CONTENT_SECURITY_POLICY,
              override: true,
            },
            contentTypeOptions: { override: true },
            frameOptions: {
              frameOption:
                overrides.frameOption ?? cloudfront.HeadersFrameOption.DENY,
              override: true,
            },
            referrerPolicy: {
              referrerPolicy:
                overrides.referrerPolicy ??
                cloudfront.HeadersReferrerPolicy
                  .STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
              override: true,
            },
            strictTransportSecurity: {
              accessControlMaxAge: Duration.seconds(
                overrides.hstsMaxAge ?? CDK.SECURITY_HEADERS.HSTS_MAX_AGE,
              ),
              includeSubdomains: overrides.hstsIncludeSubdomains ?? true,
              override: true,
              preload: true,
            },
          },
        },
      );
    }
    this.responseHeadersPolicy = resolvedResponseHeadersPolicy;

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
        ...(resolvedResponseHeadersPolicy
          ? { responseHeadersPolicy: resolvedResponseHeadersPolicy }
          : {}),
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

    // Create and attach WAF WebACL
    let resolvedWebAclArn: string | undefined;
    const wafConfig = this.resolveWafConfig(wafProp);
    if (wafConfig) {
      if (wafConfig.webAclArn) {
        // Use existing WebACL
        resolvedWebAclArn = wafConfig.webAclArn;
        this.distribution.attachWebAclId(wafConfig.webAclArn);
      } else {
        // Create new WebACL
        const {
          managedRuleOverrides,
          managedRules = DEFAULT_MANAGED_RULES,
          rateLimitPerIp = DEFAULT_RATE_LIMIT,
        } = wafConfig;

        let priority = 0;
        const rules: wafv2.CfnWebACL.RuleProperty[] = [];

        // Add managed rule groups
        for (const ruleName of managedRules) {
          const ruleActionOverrides = managedRuleOverrides?.[ruleName];
          rules.push({
            name: ruleName,
            priority: priority++,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                name: ruleName,
                vendorName: "AWS",
                ...(ruleActionOverrides && { ruleActionOverrides }),
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: ruleName,
              sampledRequestsEnabled: true,
            },
          });
        }

        // Add rate-based rule
        rules.push({
          name: "RateLimitPerIp",
          priority: priority++,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: "IP",
              limit: rateLimitPerIp,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitPerIp",
            sampledRequestsEnabled: true,
          },
        });

        const webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
          defaultAction: { allow: {} },
          name: constructEnvName("WebAcl"),
          rules,
          scope: "CLOUDFRONT",
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: constructEnvName("WebAcl"),
            sampledRequestsEnabled: true,
          },
        });

        this.webAcl = webAcl;
        resolvedWebAclArn = webAcl.attrArn;
        this.distribution.attachWebAclId(webAcl.attrArn);
        Tags.of(webAcl).add(CDK.TAG.ROLE, roleTag);
      }
    }

    // Create WAF logging
    if (resolvedWebAclArn && wafConfig) {
      const { logBucket: wafLogBucketProp = true } = wafConfig;

      let wafLogBucket: s3.IBucket | undefined;
      if (wafLogBucketProp === true) {
        // Create inline WAF logging bucket with Datadog forwarding
        const createdBucket = new s3.Bucket(
          this,
          constructEnvName("WafLogBucket"),
          {
            bucketName: `aws-waf-logs-${constructEnvName("waf").toLowerCase()}`,
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
            removalPolicy: RemovalPolicy.RETAIN,
          },
        );
        Tags.of(createdBucket).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);

        // Add Datadog forwarder notification
        if (destinationProp !== false) {
          const lambdaDestination =
            destinationProp === true
              ? new LambdaDestination(resolveDatadogForwarderFunction(this))
              : destinationProp;
          createdBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            lambdaDestination,
          );
        }

        wafLogBucket = createdBucket;
      } else if (typeof wafLogBucketProp === "object") {
        // Use provided IBucket
        wafLogBucket = wafLogBucketProp;
      }
      // wafLogBucketProp === false → no logging

      if (wafLogBucket) {
        this.wafLogBucket = wafLogBucket;
        new wafv2.CfnLoggingConfiguration(this, "WafLoggingConfig", {
          logDestinationConfigs: [wafLogBucket.bucketArn],
          resourceArn: resolvedWebAclArn,
        });
      }
    }

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

  private resolveWafConfig(
    wafProp: boolean | JaypieWafConfig,
  ): JaypieWafConfig | undefined {
    if (wafProp === false) return undefined;
    if (wafProp === true) return {};
    if (wafProp.enabled === false) return undefined;
    return wafProp;
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
