import { CDK } from "./constants";
import * as cdk from "aws-cdk-lib";
import { Policy, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import { Bucket, BucketProps, IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface JaypieDatadogBucketProps extends BucketProps {
  /**
   * Optional construct ID
   * @default "DatadogArchiveBucket"
   */
  id?: string;

  /**
   * The service tag value
   * @default CDK.SERVICE.DATADOG
   */
  service?: string;

  /**
   * Optional project tag value
   */
  project?: string;

  /**
   * Whether to grant Datadog role access to this bucket
   * Uses CDK_ENV_DATADOG_ROLE_ARN if set
   * @default true
   */
  grantDatadogAccess?: boolean;
}

export class JaypieDatadogBucket extends Construct {
  public readonly bucket: IBucket;
  public readonly policy?: Policy;

  /**
   * Create a new S3 bucket for Datadog log archiving with automatic IAM permissions
   */
  constructor(
    scope: Construct,
    idOrProps?: string | JaypieDatadogBucketProps,
    propsOrUndefined?: JaypieDatadogBucketProps,
  ) {
    // Handle overloaded constructor signatures
    let props: JaypieDatadogBucketProps;
    let id: string;

    if (typeof idOrProps === "string") {
      // First param is ID, second is props
      props = propsOrUndefined || {};
      id = idOrProps;
    } else {
      // First param is props
      props = idOrProps || {};
      id = props.id || "DatadogArchiveBucket";
    }

    super(scope, id);

    // Extract Jaypie-specific options
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      grantDatadogAccess = true,
      id: _id,
      project,
      service = CDK.SERVICE.DATADOG,
      ...bucketProps
    } = props;

    // Create the bucket
    this.bucket = new Bucket(this, "Bucket", bucketProps);

    // Add tags to bucket
    cdk.Tags.of(this.bucket).add(CDK.TAG.SERVICE, service);
    cdk.Tags.of(this.bucket).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
    if (project) {
      cdk.Tags.of(this.bucket).add(CDK.TAG.PROJECT, project);
    }

    // Grant Datadog role access to bucket if enabled
    if (grantDatadogAccess) {
      this.policy = this.grantDatadogRoleBucketAccess({ project, service });
    }
  }

  /**
   * Grants the Datadog IAM role access to this bucket
   *
   * Checks for CDK_ENV_DATADOG_ROLE_ARN environment variable.
   * If found, creates a custom policy with:
   * - s3:ListBucket on bucket
   * - s3:GetObject and s3:PutObject on bucket/*
   *
   * @param options - Configuration options
   * @returns The created Policy, or undefined if CDK_ENV_DATADOG_ROLE_ARN is not set
   */
  private grantDatadogRoleBucketAccess(options?: {
    project?: string;
    service?: string;
  }): Policy | undefined {
    const datadogRoleArn = process.env.CDK_ENV_DATADOG_ROLE_ARN;

    // Early return if no Datadog role ARN is configured
    if (!datadogRoleArn) {
      return undefined;
    }

    const { project, service = CDK.SERVICE.DATADOG } = options || {};

    // Lookup the Datadog role
    const datadogRole = Role.fromRoleArn(this, "DatadogRole", datadogRoleArn);

    // Build policy statements for bucket access
    const statements: PolicyStatement[] = [
      // Allow list bucket
      new PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [this.bucket.bucketArn],
      }),
      // Allow read and write to the bucket
      new PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [`${this.bucket.bucketArn}/*`],
      }),
    ];

    // Create the custom policy
    const datadogBucketPolicy = new Policy(this, "DatadogBucketPolicy", {
      roles: [datadogRole],
      statements,
    });

    // Add tags
    cdk.Tags.of(datadogBucketPolicy).add(CDK.TAG.SERVICE, service);
    cdk.Tags.of(datadogBucketPolicy).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
    cdk.Tags.of(datadogBucketPolicy).add(CDK.TAG.VENDOR, CDK.VENDOR.DATADOG);
    if (project) {
      cdk.Tags.of(datadogBucketPolicy).add(CDK.TAG.PROJECT, project);
    }

    return datadogBucketPolicy;
  }
}
