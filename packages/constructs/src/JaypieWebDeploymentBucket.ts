import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  Tags,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import {
  AddToResourcePolicyResult,
  Effect,
  FederatedPrincipal,
  Role,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import * as kms from "aws-cdk-lib/aws-kms";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";
import {
  constructEnvName,
  constructWafLogBucketName,
  envHostname,
  HostConfig,
  isProductionEnv,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  resolveCertificate,
} from "./helpers";
import { resolveDatadogForwarderFunction } from "./helpers/resolveDatadogForwarderFunction";
import {
  JaypieWafConfig,
  SecurityHeadersOverrides,
} from "./JaypieDistribution";
import { JaypieHostedZone } from "./JaypieHostedZone";

const DEFAULT_RATE_LIMIT = 2000;

const DEFAULT_MANAGED_RULES = [
  "AWSManagedRulesCommonRuleSet",
  "AWSManagedRulesKnownBadInputsRuleSet",
];

/**
 * WAF configuration for JaypieWebDeploymentBucket. Same shape as
 * JaypieDistribution's JaypieWafConfig, but `name` is optional — when omitted,
 * the construct id is used to namespace the WebACL and WAF log bucket.
 */
export type JaypieWebDeploymentBucketWafConfig = Omit<
  JaypieWafConfig,
  "name"
> & {
  name?: string;
};

export interface JaypieWebDeploymentBucketProps extends s3.BucketProps {
  /**
   * SSL certificate for the CloudFront distribution
   * @default true (creates a new certificate)
   */
  certificate?: boolean | acm.ICertificate;
  /**
   * Log destination configuration for CloudFront access logs.
   * - LambdaDestination: Use a specific Lambda destination for S3 notifications
   * - true: Use Datadog forwarder for S3 notifications (default)
   * - false: Disable S3 notifications (logging still occurs if logBucket is set)
   * @default true
   */
  destination?: LambdaDestination | boolean;
  /**
   * The domain name for the website.
   *
   * Supports both string and config object:
   * - String: used directly as the domain name (e.g., "app.example.com")
   * - Object: passed to envHostname() to construct the domain name
   *   - { subdomain, domain, env, component }
   *
   * @default mergeDomain(CDK_ENV_WEB_SUBDOMAIN, CDK_ENV_WEB_HOSTED_ZONE || CDK_ENV_HOSTED_ZONE)
   *
   * @example
   * // Direct string
   * host: "app.example.com"
   *
   * @example
   * // Config object - resolves using envHostname()
   * host: { subdomain: "app" }
   */
  host?: string | HostConfig;
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
   * Optional bucket name
   */
  name?: string;
  /**
   * Full override for the response headers policy.
   * When provided, bypasses all default security header logic.
   */
  responseHeadersPolicy?: cloudfront.IResponseHeadersPolicy;
  /**
   * Role tag for tagging resources
   * @default CDK.ROLE.HOSTING
   */
  roleTag?: string;
  /**
   * Security headers configuration.
   * - true/undefined: apply sensible defaults (HSTS, X-Frame-Options, CSP, etc.)
   * - false: disable security headers entirely
   * - SecurityHeadersOverrides object: merge overrides with defaults
   * @default true
   */
  securityHeaders?: boolean | SecurityHeadersOverrides;
  /**
   * WAF WebACL configuration for the CloudFront distribution.
   * - true/undefined: create and attach a WebACL with sensible defaults; the
   *   construct id is used to namespace the WebACL and WAF log bucket
   * - false: disable WAF
   * - JaypieWebDeploymentBucketWafConfig: customize WAF behavior; if `name`
   *   is omitted the construct id is used
   * @default true
   */
  waf?: boolean | JaypieWebDeploymentBucketWafConfig;
  /**
   * The hosted zone for DNS records
   * @default CDK_ENV_WEB_HOSTED_ZONE || CDK_ENV_HOSTED_ZONE
   */
  zone?: string | route53.IHostedZone | JaypieHostedZone;
}

export class JaypieWebDeploymentBucket extends Construct implements s3.IBucket {
  public readonly bucket: s3.Bucket;
  public readonly bucketArn: string;
  public readonly bucketDomainName: string;
  public readonly bucketDualStackDomainName: string;
  public readonly bucketName: string;
  public readonly bucketRegionalDomainName: string;
  public readonly bucketWebsiteDomainName: string;
  public readonly bucketWebsiteUrl: string;
  public readonly encryptionKey?: kms.IKey;
  public readonly isWebsite?: boolean;
  public readonly notificationsHandlerRole?: string;
  public readonly policy?: s3.BucketPolicy;
  public readonly deployRoleArn?: string;
  public readonly distributionDomainName?: string;
  public readonly certificate?: acm.ICertificate;
  public readonly distribution?: cloudfront.Distribution;
  public readonly logBucket?: s3.IBucket;
  public readonly responseHeadersPolicy?: cloudfront.IResponseHeadersPolicy;
  public readonly wafLogBucket?: s3.IBucket;
  public readonly webAcl?: wafv2.CfnWebACL;

  constructor(
    scope: Construct,
    id: string,
    props: JaypieWebDeploymentBucketProps = {},
  ) {
    super(scope, id);

    const {
      certificate: certificateProp,
      destination: destinationProp = true,
      host: propsHost,
      logBucket: logBucketProp,
      name: nameProp,
      responseHeadersPolicy: responseHeadersPolicyProp,
      roleTag: roleTagProp,
      securityHeaders: securityHeadersProp,
      waf: wafProp = true,
      zone: propsZone,
      ...bucketProps
    } = props;

    const roleTag = roleTagProp || CDK.ROLE.HOSTING;

    // Environment variable validation
    if (
      process.env.CDK_ENV_WEB_SUBDOMAIN &&
      !isValidSubdomain(process.env.CDK_ENV_WEB_SUBDOMAIN)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_WEB_SUBDOMAIN is not a valid subdomain",
      );
    }

    if (
      process.env.CDK_ENV_WEB_HOSTED_ZONE &&
      !isValidHostname(process.env.CDK_ENV_WEB_HOSTED_ZONE)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_WEB_HOSTED_ZONE is not a valid hostname",
      );
    }

    if (
      process.env.CDK_ENV_HOSTED_ZONE &&
      !isValidHostname(process.env.CDK_ENV_HOSTED_ZONE)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_HOSTED_ZONE is not a valid hostname",
      );
    }

    // Determine host from props or environment
    let host: string | undefined;
    if (typeof propsHost === "string") {
      host = propsHost;
    } else if (typeof propsHost === "object") {
      try {
        host = envHostname(propsHost);
      } catch {
        host = undefined;
      }
    } else {
      try {
        host =
          process.env.CDK_ENV_WEB_HOST ||
          mergeDomain(
            process.env.CDK_ENV_WEB_SUBDOMAIN || "",
            process.env.CDK_ENV_WEB_HOSTED_ZONE ||
              process.env.CDK_ENV_HOSTED_ZONE ||
              "",
          );
      } catch {
        host = undefined;
      }
    }

    if (host && !isValidHostname(host)) {
      throw new ConfigurationError("Host is not a valid hostname");
    }

    // Determine zone from props or environment
    const zone =
      propsZone ||
      process.env.CDK_ENV_WEB_HOSTED_ZONE ||
      process.env.CDK_ENV_HOSTED_ZONE;

    // Create the S3 bucket
    this.bucket = new s3.Bucket(this, "DestinationBucket", {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
      bucketName: nameProp || constructEnvName("web"),
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
      websiteErrorDocument: "index.html",
      websiteIndexDocument: "index.html",
      ...bucketProps,
    });

    // Delegate IBucket properties to the bucket
    this.bucketArn = this.bucket.bucketArn;
    this.bucketDomainName = this.bucket.bucketDomainName;
    this.bucketDualStackDomainName = this.bucket.bucketDualStackDomainName;
    this.bucketName = this.bucket.bucketName;
    this.bucketRegionalDomainName = this.bucket.bucketRegionalDomainName;
    this.bucketWebsiteDomainName = this.bucket.bucketWebsiteDomainName;
    this.bucketWebsiteUrl = this.bucket.bucketWebsiteUrl;
    this.encryptionKey = this.bucket.encryptionKey;
    this.isWebsite = this.bucket.isWebsite;
    this.notificationsHandlerRole = undefined;
    this.policy = this.bucket.policy;

    Tags.of(this.bucket).add(CDK.TAG.ROLE, roleTag);

    // Create deployment role if repository is configured
    let repo: string | undefined;
    if (process.env.CDK_ENV_REPO) {
      repo = `repo:${process.env.CDK_ENV_REPO}:*`;
    }

    let bucketDeployRole: Role | undefined;
    if (repo) {
      bucketDeployRole = new Role(this, "DestinationBucketDeployRole", {
        assumedBy: new FederatedPrincipal(
          Fn.importValue(CDK.IMPORT.OIDC_PROVIDER),
          {
            StringLike: {
              "token.actions.githubusercontent.com:sub": repo,
            },
          },
          "sts:AssumeRoleWithWebIdentity",
        ),
        maxSessionDuration: Duration.hours(1),
      });
      Tags.of(bucketDeployRole).add(CDK.TAG.ROLE, CDK.ROLE.DEPLOY);

      // Allow the role to write to the bucket
      bucketDeployRole.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "s3:DeleteObject",
            "s3:GetObject",
            "s3:ListObjectsV2",
            "s3:PutObject",
          ],
          resources: [`${this.bucket.bucketArn}/*`],
        }),
      );
      bucketDeployRole.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["s3:ListBucket"],
          resources: [this.bucket.bucketArn],
        }),
      );

      // Allow the role to describe the current stack
      const stack = Stack.of(this);
      bucketDeployRole.addToPolicy(
        new PolicyStatement({
          actions: ["cloudformation:DescribeStacks"],
          effect: Effect.ALLOW,
          resources: [
            `arn:aws:cloudformation:${stack.region}:${stack.account}:stack/${stack.stackName}/*`,
          ],
        }),
      );

      this.deployRoleArn = bucketDeployRole.roleArn;

      // Output the deploy role ARN
      new CfnOutput(this, "DestinationBucketDeployRoleArn", {
        value: bucketDeployRole.roleArn,
      });

      // Output the bucket name for workflows
      new CfnOutput(this, "DestinationBucketName", {
        value: this.bucket.bucketName,
      });
    }

    // Create CloudFront distribution and certificate if host and zone are provided
    if (host && zone) {
      let hostedZone: route53.IHostedZone;
      if (typeof zone === "string") {
        hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
          domainName: zone,
        });
      } else if (zone instanceof JaypieHostedZone) {
        hostedZone = zone.hostedZone;
      } else {
        hostedZone = zone;
      }

      // Use resolveCertificate to create certificate at stack level (enables reuse when swapping constructs)
      this.certificate = resolveCertificate(this, {
        certificate: certificateProp,
        domainName: host,
        roleTag,
        zone: hostedZone,
      });

      if (this.certificate) {
        new CfnOutput(this, "CertificateArn", {
          value: this.certificate.certificateArn,
        });
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
                  value:
                    "no-store, no-cache, must-revalidate, proxy-revalidate",
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

      // Resolve or create access log bucket
      let accessLogBucket: s3.IBucket | undefined;
      const isExternalLogBucket = logBucketProp !== undefined;

      if (logBucketProp !== undefined) {
        accessLogBucket = this.resolveLogBucket(logBucketProp);
      } else if (destinationProp !== false) {
        const createdBucket = new s3.Bucket(
          this,
          constructEnvName("LogBucket"),
          {
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
          },
        );
        Tags.of(createdBucket).add(CDK.TAG.ROLE, CDK.ROLE.STORAGE);
        accessLogBucket = createdBucket;
      }

      if (
        accessLogBucket &&
        destinationProp !== false &&
        !isExternalLogBucket
      ) {
        const lambdaDestination =
          destinationProp === true
            ? new LambdaDestination(resolveDatadogForwarderFunction(this))
            : destinationProp;

        (accessLogBucket as s3.Bucket).addEventNotification(
          s3.EventType.OBJECT_CREATED,
          lambdaDestination,
        );
      }

      this.logBucket = accessLogBucket;

      // Create CloudFront distribution
      this.distribution = new cloudfront.Distribution(this, "Distribution", {
        defaultBehavior: {
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          origin: new origins.S3StaticWebsiteOrigin(this.bucket),
          ...(resolvedResponseHeadersPolicy
            ? { responseHeadersPolicy: resolvedResponseHeadersPolicy }
            : {}),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        certificate: this.certificate,
        domainNames: [host],
        ...(accessLogBucket
          ? {
              enableLogging: true,
              logBucket: accessLogBucket,
              logFilePrefix: "cloudfront-logs/",
            }
          : {}),
      });
      Tags.of(this.distribution).add(CDK.TAG.ROLE, roleTag);

      // If this is production, enable caching on everything but index.html
      if (isProductionEnv()) {
        this.distribution.addBehavior(
          "/*",
          new origins.S3StaticWebsiteOrigin(this.bucket),
          {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ...(resolvedResponseHeadersPolicy
              ? { responseHeadersPolicy: resolvedResponseHeadersPolicy }
              : {}),
          },
        );
      }

      // Create DNS record
      const record = new route53.ARecord(this, "AliasRecord", {
        recordName: host,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution),
        ),
        zone: hostedZone,
      });
      Tags.of(record).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);

      this.distributionDomainName = this.distribution.distributionDomainName;

      // Output the distribution ID for cache invalidation
      new CfnOutput(this, "DistributionId", {
        value: this.distribution.distributionId,
      });

      // Add CloudFront invalidation permission to deploy role if it exists
      if (bucketDeployRole) {
        bucketDeployRole.addToPolicy(
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["cloudfront:CreateInvalidation"],
            resources: [
              `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${this.distribution.distributionId}`,
            ],
          }),
        );
      }

      // Create and attach WAF WebACL
      let resolvedWebAclArn: string | undefined;
      const wafConfig = this.resolveWafConfig(wafProp, id);
      if (wafConfig) {
        if (wafConfig.webAclArn) {
          resolvedWebAclArn = wafConfig.webAclArn;
          this.distribution.attachWebAclId(wafConfig.webAclArn);
        } else {
          const {
            managedRuleOverrides,
            managedRuleScopeDowns,
            managedRules = DEFAULT_MANAGED_RULES,
            rateLimitPerIp = DEFAULT_RATE_LIMIT,
          } = wafConfig;

          let priority = 0;
          const rules: wafv2.CfnWebACL.RuleProperty[] = [];

          for (const ruleName of managedRules) {
            const ruleActionOverrides = managedRuleOverrides?.[ruleName];
            const scopeDownStatement = managedRuleScopeDowns?.[ruleName];
            rules.push({
              name: ruleName,
              priority: priority++,
              overrideAction: { none: {} },
              statement: {
                managedRuleGroupStatement: {
                  name: ruleName,
                  vendorName: "AWS",
                  ...(ruleActionOverrides && { ruleActionOverrides }),
                  ...(scopeDownStatement && { scopeDownStatement }),
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: ruleName,
                sampledRequestsEnabled: true,
              },
            });
          }

          rules.push({
            name: "RateLimitPerIp",
            priority,
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

          const webAclName = constructEnvName(`${wafConfig.name}-WebAcl`);
          const webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
            defaultAction: { allow: {} },
            name: webAclName,
            rules,
            scope: "CLOUDFRONT",
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: webAclName,
              sampledRequestsEnabled: true,
            },
          });

          (this as { webAcl?: wafv2.CfnWebACL }).webAcl = webAcl;
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
          const wafLogBucketId = constructEnvName(
            `${wafConfig.name}-WafLogBucket`,
          );
          const wafLogBucketName = constructWafLogBucketName(wafConfig.name);
          const createdBucket = new s3.Bucket(this, wafLogBucketId, {
            bucketName: wafLogBucketName,
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
          });
          Tags.of(createdBucket).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);

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
          wafLogBucket = wafLogBucketProp;
        }

        if (wafLogBucket) {
          (this as { wafLogBucket?: s3.IBucket }).wafLogBucket = wafLogBucket;
          new wafv2.CfnLoggingConfiguration(this, "WafLoggingConfig", {
            logDestinationConfigs: [wafLogBucket.bucketArn],
            resourceArn: resolvedWebAclArn,
          });
        }
      }
    }
  }

  /**
   * Emit stack-level CfnOutputs with stable, hash-free logical IDs so they can
   * be read directly from `cdk-outputs.json` without prefix-matching. Skips
   * outputs whose underlying resource is absent.
   *
   * Logical IDs (with optional `prefix`):
   * - `${prefix}DestinationBucketName`
   * - `${prefix}DestinationBucketDeployRoleArn` (when a deploy role exists)
   * - `${prefix}DistributionId` (when a distribution exists)
   * - `${prefix}CertificateArn` (when a certificate exists)
   *
   * @returns map of created outputs keyed by their logical ID
   */
  public exportOutputs(
    options: { prefix?: string; scope?: Construct } = {},
  ): Record<string, CfnOutput> {
    const { prefix = "", scope = Stack.of(this) } = options;
    const outputs: Record<string, CfnOutput> = {};

    const create = (id: string, value: string): CfnOutput => {
      const logicalId = `${prefix}${id}`;
      const output = new CfnOutput(scope, `${logicalId}Export`, { value });
      output.overrideLogicalId(logicalId);
      outputs[logicalId] = output;
      return output;
    };

    create("DestinationBucketName", this.bucket.bucketName);

    if (this.deployRoleArn) {
      create("DestinationBucketDeployRoleArn", this.deployRoleArn);
    }

    if (this.distribution) {
      create("DistributionId", this.distribution.distributionId);
    }

    if (this.certificate) {
      create("CertificateArn", this.certificate.certificateArn);
    }

    return outputs;
  }

  private resolveWafConfig(
    wafProp: boolean | JaypieWebDeploymentBucketWafConfig,
    defaultName: string,
  ): JaypieWafConfig | undefined {
    if (wafProp === false) return undefined;
    if (wafProp === true) return { name: defaultName };
    if (wafProp.enabled === false) return undefined;
    return { ...wafProp, name: wafProp.name || defaultName };
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
    if (logBucketProp === true) {
      const bucketName = Fn.importValue(CDK.IMPORT.LOG_BUCKET);
      return s3.Bucket.fromBucketName(this, "ImportedLogBucket", bucketName);
    }

    if (this.isExportNameObject(logBucketProp)) {
      const bucketName = Fn.importValue(logBucketProp.exportName);
      return s3.Bucket.fromBucketName(this, "ImportedLogBucket", bucketName);
    }

    if (typeof logBucketProp === "string") {
      return s3.Bucket.fromBucketName(this, "ImportedLogBucket", logBucketProp);
    }

    return logBucketProp;
  }

  // Implement remaining IBucket methods by delegating to the bucket
  addEventNotification(
    event: s3.EventType,
    dest: s3.IBucketNotificationDestination,
    ...filters: s3.NotificationKeyFilter[]
  ): void {
    this.bucket.addEventNotification(event, dest, ...filters);
  }

  addObjectCreatedNotification(
    dest: s3.IBucketNotificationDestination,
    ...filters: s3.NotificationKeyFilter[]
  ): void {
    this.bucket.addObjectCreatedNotification(dest, ...filters);
  }

  addObjectRemovedNotification(
    dest: s3.IBucketNotificationDestination,
    ...filters: s3.NotificationKeyFilter[]
  ): void {
    this.bucket.addObjectRemovedNotification(dest, ...filters);
  }

  addToResourcePolicy(permission: PolicyStatement): AddToResourcePolicyResult {
    return this.bucket.addToResourcePolicy(permission);
  }

  arnForObjects(keyPattern: string): string {
    return this.bucket.arnForObjects(keyPattern);
  }

  grantDelete(identity: any, objectsKeyPattern?: any): any {
    return this.bucket.grantDelete(identity, objectsKeyPattern);
  }

  grantPublicAccess(allowedActions: string, keyPrefix?: string): any {
    return keyPrefix
      ? this.bucket.grantPublicAccess(allowedActions, keyPrefix)
      : this.bucket.grantPublicAccess(allowedActions);
  }

  grantPut(identity: any, objectsKeyPattern?: any): any {
    return this.bucket.grantPut(identity, objectsKeyPattern);
  }

  grantPutAcl(identity: any, objectsKeyPattern?: string): any {
    return this.bucket.grantPutAcl(identity, objectsKeyPattern);
  }

  grantRead(identity: any, objectsKeyPattern?: any): any {
    return this.bucket.grantRead(identity, objectsKeyPattern);
  }

  grantReadWrite(identity: any, objectsKeyPattern?: any): any {
    return this.bucket.grantReadWrite(identity, objectsKeyPattern);
  }

  grantWrite(identity: any, objectsKeyPattern?: any): any {
    return this.bucket.grantWrite(identity, objectsKeyPattern);
  }

  grantReplicationPermission(identity: any, props: any): any {
    return this.bucket.grantReplicationPermission(identity, props);
  }

  s3UrlForObject(key?: string): string {
    return this.bucket.s3UrlForObject(key);
  }

  urlForObject(key?: string): string {
    return this.bucket.urlForObject(key);
  }

  virtualHostedUrlForObject(
    key?: string,
    options?: s3.VirtualHostedStyleUrlOptions,
  ): string {
    return this.bucket.virtualHostedUrlForObject(key, options);
  }

  transferAccelerationUrlForObject(key?: string): string {
    return this.bucket.transferAccelerationUrlForObject(key);
  }

  onCloudTrailEvent(
    id: string,
    options?: s3.OnCloudTrailBucketEventOptions,
  ): any {
    return this.bucket.onCloudTrailEvent(id, options);
  }

  onCloudTrailPutObject(
    id: string,
    options?: s3.OnCloudTrailBucketEventOptions,
  ): any {
    return this.bucket.onCloudTrailPutObject(id, options);
  }

  onCloudTrailWriteObject(
    id: string,
    options?: s3.OnCloudTrailBucketEventOptions,
  ): any {
    return this.bucket.onCloudTrailWriteObject(id, options);
  }

  addCorsRule(rule: s3.CorsRule): void {
    this.bucket.addCorsRule(rule);
  }

  addInventory(inventory: s3.Inventory): void {
    this.bucket.addInventory(inventory);
  }

  addLifecycleRule(rule: s3.LifecycleRule): void {
    this.bucket.addLifecycleRule(rule);
  }

  addMetric(metric: s3.BucketMetrics): void {
    this.bucket.addMetric(metric);
  }

  enableEventBridgeNotification(): void {
    this.bucket.enableEventBridgeNotification();
  }

  addReplicationPolicy(policy: any): void {
    this.bucket.addReplicationPolicy(policy);
  }

  get stack(): any {
    return this.bucket.stack;
  }

  get env(): any {
    return this.bucket.env;
  }

  applyRemovalPolicy(policy: RemovalPolicy): void {
    this.bucket.applyRemovalPolicy(policy);
  }

  get bucketRef(): s3.BucketReference {
    return {
      bucketArn: this.bucket.bucketArn,
      bucketName: this.bucket.bucketName,
    };
  }
}
