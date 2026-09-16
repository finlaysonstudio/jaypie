import { Duration, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "../constants";

//
//
// Constants
//

/** Service principal AWS WAF uses to deliver logs to S3. */
const LOG_DELIVERY_SERVICE_PRINCIPAL = "delivery.logs.amazonaws.com";

/** Object key prefix AWS log delivery writes under. */
const LOG_DELIVERY_KEY_PREFIX = "AWSLogs";

/**
 * Default audit log retention. 365 days satisfies the 12-month audit log
 * retention in PCI DSS v4.0.1 10.5.1.
 */
const LOG_RETENTION_DEFAULT_DAYS = 365;

/** Age at which log objects move to infrequent access storage. */
const LOG_TRANSITION_DAYS = 30;

//
//
// Types
//

export interface ConstructLogBucketOptions {
  /** Explicit bucket name. WAF requires an `aws-waf-logs-` prefixed name. */
  bucketName?: string;
  /** Construct id for the bucket. */
  id: string;
  /**
   * Retention for log objects, as a `Duration` or a number of days.
   * @default 365 days
   */
  logRetention?: Duration | number;
  /** Value for the `role` tag. */
  roleTag?: string;
  /** Value for the `service` tag, when the construct carries one. */
  serviceTag?: string;
  /**
   * Declare the `delivery.logs.amazonaws.com` statements AWS WAF log delivery
   * requires, so CloudFormation owns the entire bucket policy.
   * @default false
   */
  wafDelivery?: boolean;
}

//
//
// Helper Functions
//

/**
 * Normalize a retention value to a `Duration`. A bare number is days.
 */
function resolveLogRetention(logRetention?: Duration | number): Duration {
  if (logRetention === undefined) {
    return Duration.days(LOG_RETENTION_DEFAULT_DAYS);
  }
  if (typeof logRetention === "number") {
    if (!Number.isInteger(logRetention) || logRetention < 1) {
      throw new ConfigurationError(
        "logRetention must be a positive whole number of days or a Duration",
      );
    }
    return Duration.days(logRetention);
  }
  return logRetention;
}

//
//
// Main
//

/**
 * Create a hardened log bucket for CloudFront access logs or AWS WAF logs.
 *
 * Applies the configuration baseline both `JaypieDistribution` and
 * `JaypieWebDeploymentBucket` need: all public access blocked, SSL enforced,
 * versioning on, SSE-S3 encryption, a retention lifecycle rule, and `RETAIN`
 * so audit logs outlive the stack.
 *
 * `ObjectOwnership.OBJECT_WRITER` is required by CloudFront standard logging
 * and is compatible with `BlockPublicAccess.BLOCK_ALL`: blocking public access
 * rejects public ACLs, it does not disable ACLs the way
 * `BUCKET_OWNER_ENFORCED` would.
 */
export function constructLogBucket(
  scope: Construct,
  {
    bucketName,
    id,
    logRetention,
    roleTag = CDK.ROLE.STORAGE,
    serviceTag,
    wafDelivery = false,
  }: ConstructLogBucketOptions,
): s3.Bucket {
  const expiration = resolveLogRetention(logRetention);
  const expirationDays = expiration.toDays({ integral: false });

  const bucket = new s3.Bucket(scope, id, {
    ...(bucketName ? { bucketName } : {}),
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    lifecycleRules: [
      {
        expiration,
        noncurrentVersionExpiration: expiration,
        ...(expirationDays > LOG_TRANSITION_DAYS
          ? {
              transitions: [
                {
                  storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                  transitionAfter: Duration.days(LOG_TRANSITION_DAYS),
                },
              ],
            }
          : {}),
      },
    ],
    objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    removalPolicy: RemovalPolicy.RETAIN,
    versioned: true,
  });

  if (wafDelivery) {
    const stack = Stack.of(bucket);
    const sourceArn = `arn:${stack.partition}:logs:${stack.region}:${stack.account}:*`;
    bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ["s3:GetBucketAcl"],
        conditions: {
          ArnLike: { "aws:SourceArn": sourceArn },
          StringEquals: { "aws:SourceAccount": stack.account },
        },
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal(LOG_DELIVERY_SERVICE_PRINCIPAL)],
        resources: [bucket.bucketArn],
        sid: "AWSLogDeliveryAclCheck",
      }),
    );
    bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ["s3:PutObject"],
        conditions: {
          ArnLike: { "aws:SourceArn": sourceArn },
          StringEquals: {
            "aws:SourceAccount": stack.account,
            "s3:x-amz-acl": "bucket-owner-full-control",
          },
        },
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal(LOG_DELIVERY_SERVICE_PRINCIPAL)],
        resources: [
          bucket.arnForObjects(`${LOG_DELIVERY_KEY_PREFIX}/${stack.account}/*`),
        ],
        sid: "AWSLogDeliveryWrite",
      }),
    );
  }

  Tags.of(bucket).add(CDK.TAG.ROLE, roleTag);
  if (serviceTag) {
    Tags.of(bucket).add(CDK.TAG.SERVICE, serviceTag);
  }

  return bucket;
}
