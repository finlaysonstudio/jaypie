import { CDK } from "./constants";
import * as cdk from "aws-cdk-lib";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  EventType,
  Bucket,
  BucketAccessControl,
  IBucket,
  StorageClass,
} from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import { ReadWriteType, Trail } from "aws-cdk-lib/aws-cloudtrail";
import { Construct } from "constructs";

import { resolveDatadogForwarderFunction } from "./helpers/resolveDatadogForwarderFunction";

export interface JaypieOrganizationTrailProps {
  /**
   * Optional construct ID
   * @default Generated from trail name
   */
  id?: string;

  /**
   * The name of the CloudTrail trail
   * @default Uses PROJECT_NONCE: `organization-cloudtrail-${PROJECT_NONCE}`
   */
  trailName?: string;

  /**
   * The name of the S3 bucket for CloudTrail logs
   * @default Uses PROJECT_NONCE: `organization-cloudtrail-${PROJECT_NONCE}`
   */
  bucketName?: string;

  /**
   * The service tag value
   * @default CDK.SERVICE.INFRASTRUCTURE
   */
  service?: string;

  /**
   * Optional project tag value
   */
  project?: string;

  /**
   * Whether to enable file validation for the trail
   * @default false
   */
  enableFileValidation?: boolean;

  /**
   * Number of days before logs expire
   * @default 365
   */
  expirationDays?: number;

  /**
   * Number of days before transitioning to INFREQUENT_ACCESS storage
   * @default 30
   */
  infrequentAccessTransitionDays?: number;

  /**
   * Number of days before transitioning to GLACIER storage
   * @default 180
   */
  glacierTransitionDays?: number;

  /**
   * Whether to send S3 notifications to Datadog forwarder
   * @default true
   */
  enableDatadogNotifications?: boolean;
}

export class JaypieOrganizationTrail extends Construct {
  public readonly bucket: IBucket;
  public readonly trail: Trail;

  /**
   * Create a new organization CloudTrail with S3 bucket and lifecycle policies
   */
  constructor(
    scope: Construct,
    idOrProps?: string | JaypieOrganizationTrailProps,
    propsOrUndefined?: JaypieOrganizationTrailProps,
  ) {
    // Handle overloaded constructor signatures
    let props: JaypieOrganizationTrailProps;
    let id: string;

    if (typeof idOrProps === "string") {
      // First param is ID, second is props
      props = propsOrUndefined || {};
      id = idOrProps;
    } else {
      // First param is props
      props = idOrProps || {};
      const defaultName = process.env.PROJECT_NONCE
        ? `organization-cloudtrail-${process.env.PROJECT_NONCE}`
        : "organization-cloudtrail";
      id = props.id || `${props.trailName || defaultName}-Trail`;
    }

    super(scope, id);

    // Resolve options with defaults
    const {
      bucketName = process.env.PROJECT_NONCE
        ? `organization-cloudtrail-${process.env.PROJECT_NONCE}`
        : "organization-cloudtrail",
      enableDatadogNotifications = true,
      enableFileValidation = false,
      expirationDays = 365,
      glacierTransitionDays = 180,
      infrequentAccessTransitionDays = 30,
      project,
      service = CDK.SERVICE.INFRASTRUCTURE,
      trailName = process.env.PROJECT_NONCE
        ? `organization-cloudtrail-${process.env.PROJECT_NONCE}`
        : "organization-cloudtrail",
    } = props;

    // Create the S3 bucket for CloudTrail logs
    this.bucket = new Bucket(this, "Bucket", {
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      bucketName,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(expirationDays),
          transitions: [
            {
              storageClass: StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(
                infrequentAccessTransitionDays,
              ),
            },
            {
              storageClass: StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(glacierTransitionDays),
            },
          ],
        },
      ],
    });

    // Add CloudTrail bucket policies
    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ["s3:GetBucketAcl"],
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("cloudtrail.amazonaws.com")],
        resources: [this.bucket.bucketArn],
      }),
    );

    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ["s3:PutObject"],
        conditions: {
          StringEquals: {
            "s3:x-amz-acl": "bucket-owner-full-control",
          },
        },
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("cloudtrail.amazonaws.com")],
        resources: [`${this.bucket.bucketArn}/*`],
      }),
    );

    // Add tags to bucket
    cdk.Tags.of(this.bucket).add(CDK.TAG.SERVICE, service);
    cdk.Tags.of(this.bucket).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
    if (project) {
      cdk.Tags.of(this.bucket).add(CDK.TAG.PROJECT, project);
    }

    // Add Datadog notifications if enabled
    if (enableDatadogNotifications) {
      const datadogForwarderFunction = resolveDatadogForwarderFunction(scope);
      this.bucket.addEventNotification(
        EventType.OBJECT_CREATED,
        new LambdaDestination(datadogForwarderFunction),
      );
    }

    // Create the organization trail
    this.trail = new Trail(this, "Trail", {
      bucket: this.bucket,
      enableFileValidation,
      isOrganizationTrail: true,
      managementEvents: ReadWriteType.ALL,
      trailName,
    });

    // Add tags to trail
    cdk.Tags.of(this.trail).add(CDK.TAG.SERVICE, service);
    cdk.Tags.of(this.trail).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
    if (project) {
      cdk.Tags.of(this.trail).add(CDK.TAG.PROJECT, project);
    }
  }
}
