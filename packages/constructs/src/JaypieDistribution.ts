import {
  Annotations,
  Duration,
  Fn,
  Lazy,
  RemovalPolicy,
  Stack,
  Tags,
} from "aws-cdk-lib";
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
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";
import {
  assertValidWafRuleNames,
  constructEnvName,
  constructLogBucket,
  constructWafLogBucketName,
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

/**
 * Request headers always redacted from WAF logs. A `waf` config's
 * `redactedHeaders` merges with this list rather than replacing it, so adding
 * a header can only ever redact more. `x-amz-content-sha256` is included
 * because origin access control requires clients to send a hash of the request
 * body; for a low-entropy body an unredacted hash fingerprints the body.
 */
export const DEFAULT_WAF_REDACTED_HEADERS = [
  "authorization",
  "cookie",
  "x-amz-content-sha256",
  "x-api-key",
];

const WARNING_ORIGIN_ACCESS_CONTROL_IGNORED =
  "@jaypie/constructs:originAccessControlIgnored";

/** AWS WAF accepts at most 100 redacted fields per logging configuration. */
const WAF_REDACTED_FIELDS_LIMIT = 100;

/**
 * Build the `redactedFields` list for a WAF logging configuration. The default
 * headers come first, then any caller-supplied headers not already covered,
 * then raw field matchers. Header names are compared case-insensitively, as
 * WAF matches them.
 */
export function resolveWafRedactedFields({
  redactedFields = [],
  redactedHeaders = [],
}: {
  redactedFields?: wafv2.CfnLoggingConfiguration.FieldToMatchProperty[];
  redactedHeaders?: string[];
} = {}): wafv2.CfnLoggingConfiguration.FieldToMatchProperty[] {
  const names = [...DEFAULT_WAF_REDACTED_HEADERS];
  for (const name of redactedHeaders) {
    if (!names.some((known) => known.toLowerCase() === name.toLowerCase())) {
      names.push(name);
    }
  }
  const fields: wafv2.CfnLoggingConfiguration.FieldToMatchProperty[] = [
    ...names.map((name) => ({ singleHeader: { Name: name } })),
    ...redactedFields,
  ];
  if (fields.length > WAF_REDACTED_FIELDS_LIMIT) {
    throw new ConfigurationError(
      `WAF logging accepts at most ${WAF_REDACTED_FIELDS_LIMIT} redacted fields; received ${fields.length}`,
    );
  }
  return fields;
}

/**
 * Reduces a hostname to characters legal in a CDK construct ID.
 */
function sanitizeHostForId(host: string): string {
  return host.replace(/\./g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

/**
 * One entry in a `waf.allow` list. Names one or more URL paths and, for each
 * managed rule group key, the sub-rule names to flip from `block` to `count`
 * on that path set. See JaypieWafConfig.allow.
 */
export interface JaypieWafAllowEntry {
  /** URL path or paths. Trailing `*` → STARTS_WITH; otherwise EXACTLY. */
  path: string | string[];
  /** Managed-rule-group keys (e.g. AWSManagedRulesCommonRuleSet) → sub-rule names. */
  [ruleGroupKey: string]: string | string[] | undefined;
}

export interface JaypieWafConfig {
  /**
   * Unique name for this distribution's WAF resources. Required when passing a
   * WAF config object. Injected into the WebACL name and WAF log bucket name
   * so multiple JaypieDistribution instances can coexist in the same
   * account/env without S3/WAFv2 name collisions.
   *
   * Pass `waf: true` to retain the legacy, non-namespaced names.
   */
  name: string;

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
   * Optional scope-down statements per managed rule group. When supplied,
   * the managed rule group only evaluates requests that match the
   * scope-down statement. Key is the managed rule group name; value is a
   * `CfnWebACL.StatementProperty`.
   *
   * @example
   * // Only run AWSManagedRulesCommonRuleSet for non-/chat paths
   * managedRuleScopeDowns: {
   *   AWSManagedRulesCommonRuleSet: {
   *     notStatement: {
   *       statement: {
   *         byteMatchStatement: {
   *           fieldToMatch: { uriPath: {} },
   *           positionalConstraint: "STARTS_WITH",
   *           searchString: "/chat",
   *           textTransformations: [{ priority: 0, type: "NONE" }],
   *         },
   *       },
   *     },
   *   },
   * }
   */
  managedRuleScopeDowns?: Record<string, wafv2.CfnWebACL.StatementProperty>;

  /**
   * Managed rule group names to apply
   * @default ["AWSManagedRulesCommonRuleSet", "AWSManagedRulesKnownBadInputsRuleSet"]
   */
  managedRules?: string[];

  /**
   * Retention for the WAF log bucket this construct creates. Falls back to the
   * construct's `logRetention` when unset. Has no effect on a caller-supplied
   * `logBucket`.
   */
  logRetention?: Duration | number;

  /**
   * Rate limit per IP per 5-minute window
   * @default 2000
   */
  rateLimitPerIp?: number;

  /**
   * Additional request fields redacted from WAF logs, passed through to the
   * logging configuration verbatim. Layers on top of the redacted headers.
   * AWS WAF accepts at most 100 redacted fields in total.
   *
   * @example
   * redactedFields: [{ queryString: {} }, { uriPath: {} }]
   */
  redactedFields?: wafv2.CfnLoggingConfiguration.FieldToMatchProperty[];

  /**
   * Extra request header names redacted from WAF logs. Merges with
   * `DEFAULT_WAF_REDACTED_HEADERS` (`authorization`, `cookie`,
   * `x-amz-content-sha256`, `x-api-key`) rather than replacing it, so the
   * defaults are always redacted. Matched case-insensitively.
   */
  redactedHeaders?: string[];

  /**
   * Path-scoped relaxations layered on top of the default managed-rule groups.
   * Each entry names one or more URL paths and, for each managed rule group
   * key, the sub-rule names to flip from `block` to `count` on that path set.
   * Strict default action is preserved on every other path.
   *
   * Composes with `managedRuleOverrides`: the baseline override list applies
   * to both the relaxed and strict emissions of a group; entries in `allow`
   * additionally relax specific (path × sub-rule) intersections.
   *
   * @example
   * allow: [
   *   {
   *     path: "/hooks/*",
   *     AWSManagedRulesCommonRuleSet: ["ExploitablePaths_URIPATH"],
   *     AWSManagedRulesKnownBadInputsRuleSet: ["CrossSiteScripting_BODY"],
   *   },
   * ]
   */
  allow?: JaypieWafAllowEntry | JaypieWafAllowEntry[];

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
   * Force-delete any existing Route53 A and AAAA records with the same name
   * before creating the alias records. Useful when migrating from another
   * construct (e.g., JaypieApiGateway) that already owns the same hostname,
   * where the default CloudFormation create-before-delete ordering would
   * otherwise collide on the record name.
   *
   * - `true`: force-delete for every host
   * - hostname or array of hostnames: force-delete only those hosts
   *
   * Naming hosts matters when serving several: pointing this at a host whose
   * record this construct already owns deletes the live record without
   * recreating it, because CloudFormation sees no change to the record itself.
   * Name only the hosts being reclaimed from another owner.
   *
   * @default false
   *
   * @example
   * // Reclaim api. from an API Gateway custom domain while api0. keeps serving
   * host: ["api0.example.com", "api.example.com"],
   * deleteExistingRecord: ["api.example.com"],
   */
  deleteExistingRecord?: boolean | string | string[];
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
   * Retention for log buckets this construct creates: the CloudFront access
   * log bucket and the WAF log bucket. Accepts a `Duration` or a number of
   * days. Has no effect on a bucket supplied through `logBucket` or
   * `waf.logBucket`.
   *
   * The default satisfies the 12-month audit log retention in PCI DSS v4.0.1
   * 10.5.1. Objects transition to infrequent access after 30 days whenever
   * retention exceeds 30 days.
   *
   * @default Duration.days(365)
   */
  logRetention?: Duration | number;
  /**
   * The origin handler - can be an IOrigin, IFunctionUrl, or IFunction
   * If IFunction, a FunctionUrl will be created with auth NONE
   * (or AWS_IAM when `originAccessControl` is true)
   */
  handler?: cloudfront.IOrigin | lambda.IFunctionUrl | lambda.IFunction;
  /**
   * The domain name or names for the distribution.
   *
   * Supports string, config object, or an array of either:
   * - String: used directly as the domain name (e.g., "api.example.com")
   * - Object: passed to envHostname() to construct the domain name
   *   - { subdomain, domain, env, component }
   * - Array: every entry is served by the distribution. The first entry is
   *   primary: it supplies `PROJECT_BASE_URL` and the certificate's
   *   `domainName`, with the rest becoming subject alternative names. Every
   *   entry gets an A and AAAA record.
   *
   * @default CDK_ENV_API_HOST_NAME || mergeDomain(CDK_ENV_API_SUBDOMAIN, CDK_ENV_API_HOSTED_ZONE || CDK_ENV_HOSTED_ZONE)
   *
   * @example
   * // Direct string
   * host: "api.example.com"
   *
   * @example
   * // Config object - resolves using envHostname()
   * host: { subdomain: "api" }
   *
   * @example
   * // Multiple hosts for a zero-downtime domain cutover
   * host: ["api0.example.com", "api.example.com"]
   */
  host?: string | HostConfig | Array<string | HostConfig>;
  /**
   * Enable response streaming for Lambda Function URLs.
   * Use with createLambdaStreamHandler for SSE/streaming responses.
   * @default false
   */
  streaming?: boolean;
  /**
   * Restrict the created Function URL to CloudFront using origin access
   * control (OAC). Applies only when `handler` is an `IFunction`, where this
   * construct owns the Function URL.
   *
   * - `true`: create the Function URL with `AWS_IAM` auth, front it with
   *   `FunctionUrlOrigin.withOriginAccessControl`, and grant CloudFront both
   *   `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`
   * - `false`: create the Function URL with `NONE` auth, leaving it publicly
   *   invokable around CloudFront and the WAF
   *
   * Clients must send the SHA-256 of the request body in `x-amz-content-sha256`
   * on POST and PUT: Lambda rejects a signed request without it. Salt
   * low-entropy bodies with a nonce so the hash is not reversible.
   *
   * @default false
   */
  originAccessControl?: boolean;
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
   * @default CDK.ROLE.API
   */
  roleTag?: string;
  /**
   * Service tag for attributing this distribution to a service (parallel to
   * `roleTag`, matching `JaypieLambda`). When set, the distribution is tagged
   * with `CDK.TAG.SERVICE` (so metrics carry `service:<value>` instead of
   * `service:N/A`) and the created access-log and WAF-log buckets are tagged
   * with the same value, so the Datadog forwarder attributes their forwarded
   * logs to the service instead of the generic `cloudfront`/source default.
   *
   * Omit to preserve current behavior (no service tag). Has no effect on
   * external/imported log buckets, which this construct does not own.
   * @default undefined (no service tag)
   */
  serviceTag?: string;
  /**
   * WAF WebACL configuration for the CloudFront distribution.
   * - true: create and attach a WebACL with sensible defaults
   * - false/undefined: disable WAF
   * - JaypieWafConfig: customize WAF behavior
   * @default false
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
  /** The primary host, equal to `hosts[0]` */
  public readonly host?: string;
  /** Every host served by the distribution; empty when no host resolves */
  public readonly hosts: string[];
  public readonly logBucket?: s3.IBucket;
  public readonly responseHeadersPolicy?: cloudfront.IResponseHeadersPolicy;
  public readonly wafLogBucket?: s3.IBucket;
  public readonly webAcl?: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: JaypieDistributionProps) {
    super(scope, id);

    const {
      certificate: certificateProp = true,
      defaultBehavior: propsDefaultBehavior,
      deleteExistingRecord = false,
      destination: destinationProp = true,
      handler,
      host: propsHost,
      logBucket: logBucketProp,
      logRetention,
      originAccessControl = false,
      originReadTimeout = Duration.seconds(CDK.DURATION.CLOUDFRONT_API),
      responseHeadersPolicy: responseHeadersPolicyProp,
      roleTag = CDK.ROLE.API,
      securityHeaders: securityHeadersProp,
      serviceTag,
      streaming = false,
      waf: wafProp = false,
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

    // Determine hosts from props or environment
    // The first entry is primary: PROJECT_BASE_URL, certificate domainName,
    // and the un-suffixed DNS record construct IDs all come from it
    const hosts: string[] = [];
    if (propsHost !== undefined) {
      const hostEntries = Array.isArray(propsHost) ? propsHost : [propsHost];
      for (const entry of hostEntries) {
        let resolved: string | undefined;
        if (typeof entry === "string") {
          resolved = entry;
        } else if (typeof entry === "object" && entry !== null) {
          // Resolve host from HostConfig using envHostname()
          try {
            resolved = envHostname(entry);
          } catch {
            resolved = undefined;
          }
        }
        if (resolved && !hosts.includes(resolved)) {
          hosts.push(resolved);
        }
      }
    } else {
      try {
        if (process.env.CDK_ENV_API_HOST_NAME) {
          hosts.push(process.env.CDK_ENV_API_HOST_NAME);
        } else if (process.env.CDK_ENV_API_SUBDOMAIN) {
          hosts.push(
            mergeDomain(
              process.env.CDK_ENV_API_SUBDOMAIN,
              process.env.CDK_ENV_API_HOSTED_ZONE ||
                process.env.CDK_ENV_HOSTED_ZONE ||
                "",
            ),
          );
        }
      } catch {
        // No host from environment
      }
    }

    for (const candidate of hosts) {
      if (!isValidHostname(candidate)) {
        throw new Error("Host is not a valid hostname");
      }
    }

    const host = hosts[0];

    this.host = host;
    this.hosts = hosts;

    // Determine zone from props or environment, matching the host fallback
    // Jaypie 2 consolidates on CDK_ENV_HOSTED_ZONE alone
    const zone =
      propsZone ||
      process.env.CDK_ENV_API_HOSTED_ZONE ||
      process.env.CDK_ENV_HOSTED_ZONE;

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
          authType: originAccessControl
            ? lambda.FunctionUrlAuthType.AWS_IAM
            : lambda.FunctionUrlAuthType.NONE,
          function: handler,
          invokeMode: resolvedInvokeMode,
        });
        this.functionUrl = functionUrl;
        if (originAccessControl) {
          origin = origins.FunctionUrlOrigin.withOriginAccessControl(
            functionUrl,
            { readTimeout: originReadTimeout },
          );
          // withOriginAccessControl grants lambda:InvokeFunctionUrl only.
          // Lambda requires lambda:InvokeFunction as well. The distribution
          // does not exist yet, so the source ARN resolves at synth time.
          new lambda.CfnPermission(this, "DistributionInvokeFunction", {
            action: "lambda:InvokeFunction",
            functionName: handler.functionArn,
            invokedViaFunctionUrl: true,
            principal: "cloudfront.amazonaws.com",
            sourceArn: Lazy.string({ produce: () => this.distributionArn }),
          });
        } else {
          origin = new origins.FunctionUrlOrigin(functionUrl, {
            readTimeout: originReadTimeout,
          });
        }
      } else if (this.isIFunctionUrl(handler)) {
        origin = new origins.FunctionUrlOrigin(handler, {
          readTimeout: originReadTimeout,
        });
      } else if (this.isIOrigin(handler)) {
        origin = handler;
      }

      // originAccessControl only shapes the Function URL this construct
      // creates; a caller-supplied IFunctionUrl or IOrigin owns its own auth
      if (originAccessControl && !this.isIFunction(handler)) {
        Annotations.of(this).addWarningV2(
          WARNING_ORIGIN_ACCESS_CONTROL_IGNORED,
          "originAccessControl applies only to an IFunction handler. This handler supplies its own Function URL or origin, so the prop has no effect and that origin's auth is unchanged.",
        );
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
      cloudfront.IResponseHeadersPolicy | undefined;
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
        subjectAlternativeNames: hosts.slice(1),
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
      // Create new bucket
      logBucket = constructLogBucket(this, {
        id: constructEnvName("LogBucket"),
        logRetention,
        roleTag: CDK.ROLE.STORAGE,
        serviceTag,
      });
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
              domainNames: hosts,
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
    if (serviceTag) {
      Tags.of(this.distribution).add(CDK.TAG.SERVICE, serviceTag);
    }

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
          allow,
          managedRuleOverrides,
          managedRuleScopeDowns,
          managedRules = DEFAULT_MANAGED_RULES,
          rateLimitPerIp = DEFAULT_RATE_LIMIT,
        } = wafConfig;

        // Fail synth on rule names AWS WAF would silently ignore (#362)
        assertValidWafRuleNames({ allow, managedRuleOverrides });

        const allowEntries: JaypieWafAllowEntry[] = allow
          ? Array.isArray(allow)
            ? allow
            : [allow]
          : [];

        // Group allow entries by managed rule group name
        type GroupAllowance = { paths: string[]; ruleNames: string[] };
        const groupAllowances: Record<string, GroupAllowance[]> = {};
        for (const entry of allowEntries) {
          const paths = Array.isArray(entry.path) ? entry.path : [entry.path];
          for (const key of Object.keys(entry)) {
            if (key === "path") continue;
            const raw = entry[key];
            if (raw == null) continue;
            const ruleNames = Array.isArray(raw) ? raw : [raw];
            if (!groupAllowances[key]) groupAllowances[key] = [];
            groupAllowances[key].push({ paths, ruleNames });
          }
        }

        const pathToStatement = (
          path: string,
        ): wafv2.CfnWebACL.StatementProperty => {
          const isPrefix = path.endsWith("*");
          return {
            byteMatchStatement: {
              fieldToMatch: { uriPath: {} },
              positionalConstraint: isPrefix ? "STARTS_WITH" : "EXACTLY",
              searchString: isPrefix ? path.slice(0, -1) : path,
              textTransformations: [{ priority: 0, type: "NONE" }],
            },
          };
        };

        const pathsToStatement = (
          paths: string[],
        ): wafv2.CfnWebACL.StatementProperty => {
          if (paths.length === 1) return pathToStatement(paths[0]);
          return {
            orStatement: { statements: paths.map(pathToStatement) },
          };
        };

        const andScopeDown = (
          base: wafv2.CfnWebACL.StatementProperty | undefined,
          extra: wafv2.CfnWebACL.StatementProperty,
        ): wafv2.CfnWebACL.StatementProperty =>
          base ? { andStatement: { statements: [base, extra] } } : extra;

        let priority = 0;
        const rules: wafv2.CfnWebACL.RuleProperty[] = [];

        // Add managed rule groups
        for (const ruleName of managedRules) {
          const baseOverrides = managedRuleOverrides?.[ruleName];
          const baseScopeDown = managedRuleScopeDowns?.[ruleName];
          const allowances = groupAllowances[ruleName];

          if (!allowances || allowances.length === 0) {
            rules.push({
              name: ruleName,
              priority: priority++,
              overrideAction: { none: {} },
              statement: {
                managedRuleGroupStatement: {
                  name: ruleName,
                  vendorName: "AWS",
                  ...(baseOverrides && { ruleActionOverrides: baseOverrides }),
                  ...(baseScopeDown && { scopeDownStatement: baseScopeDown }),
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: ruleName,
                sampledRequestsEnabled: true,
              },
            });
            continue;
          }

          // Emit one relaxed rule per allow entry that names this group
          allowances.forEach(({ paths, ruleNames }, index) => {
            const entryOverrides: wafv2.CfnWebACL.RuleActionOverrideProperty[] =
              ruleNames.map((n) => ({
                name: n,
                actionToUse: { count: {} },
              }));
            const combinedOverrides = [
              ...(baseOverrides ?? []),
              ...entryOverrides,
            ];
            const relaxedScopeDown = andScopeDown(
              baseScopeDown,
              pathsToStatement(paths),
            );
            const relaxedName = `${ruleName}-allow-${index}`;
            rules.push({
              name: relaxedName,
              priority: priority++,
              overrideAction: { none: {} },
              statement: {
                managedRuleGroupStatement: {
                  name: ruleName,
                  vendorName: "AWS",
                  ruleActionOverrides: combinedOverrides,
                  scopeDownStatement: relaxedScopeDown,
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: relaxedName,
                sampledRequestsEnabled: true,
              },
            });
          });

          // Emit one strict rule whose scope-down excludes every relaxed path
          const allPaths = allowances.flatMap((a) => a.paths);
          const strictScopeDown = andScopeDown(baseScopeDown, {
            notStatement: { statement: pathsToStatement(allPaths) },
          });
          rules.push({
            name: ruleName,
            priority: priority++,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                name: ruleName,
                vendorName: "AWS",
                ...(baseOverrides && { ruleActionOverrides: baseOverrides }),
                scopeDownStatement: strictScopeDown,
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

        const webAclName = wafConfig.name
          ? constructEnvName(`${wafConfig.name}-WebAcl`)
          : constructEnvName("WebAcl");
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
        const wafLogBucketId = wafConfig.name
          ? constructEnvName(`${wafConfig.name}-WafLogBucket`)
          : constructEnvName("WafLogBucket");
        const wafLogBucketName = constructWafLogBucketName(wafConfig.name);
        const createdBucket = constructLogBucket(this, {
          bucketName: wafLogBucketName,
          id: wafLogBucketId,
          logRetention: wafConfig.logRetention ?? logRetention,
          roleTag: CDK.ROLE.MONITORING,
          serviceTag,
          wafDelivery: true,
        });

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
        const wafLoggingConfig = new wafv2.CfnLoggingConfiguration(
          this,
          "WafLoggingConfig",
          {
            logDestinationConfigs: [wafLogBucket.bucketArn],
            redactedFields: resolveWafRedactedFields({
              redactedFields: wafConfig.redactedFields,
              redactedHeaders: wafConfig.redactedHeaders,
            }),
            resourceArn: resolvedWebAclArn,
          },
        );
        // The logging configuration only references the bucket, so nothing
        // orders it after the bucket policy carrying the log delivery grants
        if (wafLogBucket instanceof s3.Bucket && wafLogBucket.policy) {
          wafLoggingConfig.node.addDependency(wafLogBucket.policy);
        }
      }
    }

    // Create DNS records if we have hosts and zone
    // The primary host keeps the un-suffixed construct IDs so adding a second
    // host does not replace records an existing deployment already owns
    if (hostedZone) {
      const deleteExistingHosts =
        typeof deleteExistingRecord === "string"
          ? [deleteExistingRecord]
          : Array.isArray(deleteExistingRecord)
            ? deleteExistingRecord
            : undefined;

      hosts.forEach((recordHost, index) => {
        const suffix = index === 0 ? "" : `-${sanitizeHostForId(recordHost)}`;
        const deleteExisting = deleteExistingHosts
          ? deleteExistingHosts.includes(recordHost)
          : deleteExistingRecord === true;

        const aRecord = new route53.ARecord(this, `AliasRecord${suffix}`, {
          deleteExisting,
          recordName: recordHost,
          target: route53.RecordTarget.fromAlias(
            new route53Targets.CloudFrontTarget(this.distribution),
          ),
          zone: hostedZone,
        });
        Tags.of(aRecord).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);

        const aaaaRecord = new route53.AaaaRecord(
          this,
          `AaaaAliasRecord${suffix}`,
          {
            deleteExisting,
            recordName: recordHost,
            target: route53.RecordTarget.fromAlias(
              new route53Targets.CloudFrontTarget(this.distribution),
            ),
            zone: hostedZone,
          },
        );
        Tags.of(aaaaRecord).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
      });
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
  ): Partial<JaypieWafConfig> | undefined {
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
