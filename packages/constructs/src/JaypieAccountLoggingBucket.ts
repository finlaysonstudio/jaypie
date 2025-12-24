import { CDK } from "./constants";
import * as cdk from "aws-cdk-lib";
import {
  Bucket,
  BucketAccessControl,
  BucketProps,
  IBucket,
  StorageClass,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface JaypieAccountLoggingBucketProps extends BucketProps {
  /**
   * Optional construct ID
   * @default "AccountLoggingBucket"
   */
  id?: string;

  /**
   * Bucket name
   * @default `account-logging-stack-${PROJECT_NONCE}`
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
   * Whether to create CloudFormation output for bucket name
   * @default true
   */
  createOutput?: boolean;

  /**
   * Custom export name for the bucket name output
   * @default CDK.IMPORT.LOG_BUCKET
   */
  exportName?: string;

  /**
   * Description for the CloudFormation output
   * @default "Account-wide logging bucket"
   */
  outputDescription?: string;
}

export class JaypieAccountLoggingBucket extends Construct {
  public readonly bucket: IBucket;

  /**
   * Create a new account-wide logging S3 bucket with lifecycle policies and export
   */
  constructor(
    scope: Construct,
    idOrProps?: string | JaypieAccountLoggingBucketProps,
    propsOrUndefined?: JaypieAccountLoggingBucketProps,
  ) {
    // Handle overloaded constructor signatures
    let props: JaypieAccountLoggingBucketProps;
    let id: string;

    if (typeof idOrProps === "string") {
      // First param is ID, second is props
      props = propsOrUndefined || {};
      id = idOrProps;
    } else {
      // First param is props
      props = idOrProps || {};
      id = props.id || "AccountLoggingBucket";
    }

    super(scope, id);

    // Generate default bucket name with PROJECT_NONCE
    const defaultBucketName = process.env.PROJECT_NONCE
      ? `account-logging-stack-${process.env.PROJECT_NONCE.toLowerCase()}`
      : "account-logging-stack";

    // Extract Jaypie-specific options

    const {
      bucketName = defaultBucketName,
      createOutput = true,
      expirationDays = 365,
      exportName = CDK.IMPORT.LOG_BUCKET,
      glacierTransitionDays = 180,
      id: _id,
      infrequentAccessTransitionDays = 30,
      outputDescription = "Account-wide logging bucket",
      project,
      service = CDK.SERVICE.INFRASTRUCTURE,
      ...bucketProps
    } = props;

    // Create the bucket with lifecycle rules
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
      ...bucketProps,
    });

    // Add tags
    cdk.Tags.of(this.bucket).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
    if (service) {
      cdk.Tags.of(this.bucket).add(CDK.TAG.SERVICE, service);
    }
    if (project) {
      cdk.Tags.of(this.bucket).add(CDK.TAG.PROJECT, project);
    }

    // Create CloudFormation output if enabled
    if (createOutput) {
      new cdk.CfnOutput(this, "BucketNameOutput", {
        description: outputDescription,
        exportName,
        value: this.bucket.bucketName,
      });
    }
  }
}
