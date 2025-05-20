import { Construct } from "constructs";
import { Tags, RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { CDK } from "@jaypie/cdk";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import {
  JaypieQueuedLambda,
  JaypieQueuedLambdaProps,
} from "./JaypieQueuedLambda.js";

export interface JaypieBucketQueuedLambdaProps extends JaypieQueuedLambdaProps {
  bucketName?: string;
  bucketOptions?: s3.BucketProps;
}

export class JaypieBucketQueuedLambda
  extends JaypieQueuedLambda
  implements s3.IBucket
{
  private readonly _bucket: s3.Bucket;

  constructor(
    scope: Construct,
    id: string,
    props: JaypieBucketQueuedLambdaProps,
  ) {
    super(scope, id, props);

    const { bucketName, roleTag, vendorTag, bucketOptions = {} } = props;

    // Create S3 Bucket
    this._bucket = new s3.Bucket(this, "Bucket", {
      bucketName: bucketOptions.bucketName || bucketName,
      removalPolicy: bucketOptions.removalPolicy || RemovalPolicy.RETAIN,
      ...bucketOptions,
    });

    // Add tags to bucket
    if (roleTag) {
      Tags.of(this._bucket).add(CDK.TAG.ROLE, roleTag);
    }
    if (vendorTag) {
      Tags.of(this._bucket).add(CDK.TAG.VENDOR, vendorTag);
    }

    // Add an event notification from the bucket to the queue
    this._bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(this.queue),
    );

    // Grant the lambda access to the bucket
    this._bucket.grantReadWrite(this);

    // Add environment variable for bucket name
    this.lambda.addEnvironment("CDK_ENV_BUCKET_NAME", this._bucket.bucketName);
  }

  // Public accessors
  public get bucket(): s3.Bucket {
    return this._bucket;
  }

  // IBucket implementation
  public get bucketArn(): string {
    return this._bucket.bucketArn;
  }

  public get bucketDomainName(): string {
    return this._bucket.bucketDomainName;
  }

  public get bucketDualStackDomainName(): string {
    return this._bucket.bucketDualStackDomainName;
  }

  public get bucketName(): string {
    return this._bucket.bucketName;
  }

  public get bucketRegionalDomainName(): string {
    return this._bucket.bucketRegionalDomainName;
  }

  public get bucketWebsiteDomainName(): string {
    return this._bucket.bucketWebsiteDomainName;
  }

  public get bucketWebsiteUrl(): string {
    return this._bucket.bucketWebsiteUrl;
  }

  public get encryptionKey(): undefined | import("aws-cdk-lib/aws-kms").IKey {
    return this._bucket.encryptionKey;
  }

  public get isWebsite(): boolean {
    return this._bucket.isWebsite;
  }

  public get policy(): s3.BucketPolicy | undefined {
    return this._bucket.policy;
  }

  public addEventNotification(
    event: s3.EventType,
    dest: s3.IBucketNotificationDestination,
    filters?: s3.NotificationKeyFilter[],
  ): void {
    this._bucket.addEventNotification(event, dest, ...filters);
  }

  public addObjectCreatedNotification(
    dest: s3.IBucketNotificationDestination,
    ...filters: s3.NotificationKeyFilter[]
  ): void {
    this._bucket.addObjectCreatedNotification(dest, ...filters);
  }

  public addObjectRemovedNotification(
    dest: s3.IBucketNotificationDestination,
    ...filters: s3.NotificationKeyFilter[]
  ): void {
    this._bucket.addObjectRemovedNotification(dest, ...filters);
  }

  public addToResourcePolicy(
    permission: iam.PolicyStatement,
  ): iam.AddToResourcePolicyResult {
    return this._bucket.addToResourcePolicy(permission);
  }

  public arnForObjects(objectKeyPattern: string): string {
    return this._bucket.arnForObjects(objectKeyPattern);
  }

  public enableEventBridgeNotification(): void {
    this._bucket.enableEventBridgeNotification();
  }

  public grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {
    return this._bucket.grant(grantee, ...actions);
  }

  public grantDelete(
    grantee: iam.IGrantable,
    objectsKeyPattern?: any,
  ): iam.Grant {
    return this._bucket.grantDelete(grantee, objectsKeyPattern);
  }

  public grantPublicAccess(
    keyPrefix?: string,
    ...allowedActions: string[]
  ): iam.Grant {
    return this._bucket.grantPublicAccess(keyPrefix, ...allowedActions);
  }

  public grantPut(grantee: iam.IGrantable, objectsKeyPattern?: any): iam.Grant {
    return this._bucket.grantPut(grantee, objectsKeyPattern);
  }

  public grantPutAcl(
    grantee: iam.IGrantable,
    objectsKeyPattern?: string,
  ): iam.Grant {
    return this._bucket.grantPutAcl(grantee, objectsKeyPattern);
  }

  public grantRead(
    grantee: iam.IGrantable,
    objectsKeyPattern?: any,
  ): iam.Grant {
    return this._bucket.grantRead(grantee, objectsKeyPattern);
  }

  public grantReadWrite(
    grantee: iam.IGrantable,
    objectsKeyPattern?: any,
  ): iam.Grant {
    return this._bucket.grantReadWrite(grantee, objectsKeyPattern);
  }

  public grantWrite(
    grantee: iam.IGrantable,
    objectsKeyPattern?: any,
  ): iam.Grant {
    return this._bucket.grantWrite(grantee, objectsKeyPattern);
  }

  public onCloudTrailEvent(
    id: string,
    options?: s3.OnCloudTrailBucketEventOptions,
  ): import("aws-cdk-lib/aws-events").Rule {
    return this._bucket.onCloudTrailEvent(id, options);
  }

  public onCloudTrailPutObject(
    id: string,
    options?: s3.OnCloudTrailBucketEventOptions,
  ): import("aws-cdk-lib/aws-events").Rule {
    return this._bucket.onCloudTrailPutObject(id, options);
  }

  public onCloudTrailWriteObject(
    id: string,
    options?: s3.OnCloudTrailBucketEventOptions,
  ): import("aws-cdk-lib/aws-events").Rule {
    return this._bucket.onCloudTrailWriteObject(id, options);
  }

  public s3UrlForObject(key?: string): string {
    return this._bucket.s3UrlForObject(key);
  }

  public transferAccelerationUrlForObject(
    key?: string,
    options?: s3.TransferAccelerationUrlOptions,
  ): string {
    return this._bucket.transferAccelerationUrlForObject(key, options);
  }

  public urlForObject(key?: string): string {
    return this._bucket.urlForObject(key);
  }

  public virtualHostedUrlForObject(
    key?: string,
    options?: s3.VirtualHostedStyleUrlOptions,
  ): string {
    return this._bucket.virtualHostedUrlForObject(key, options);
  }

  // Bucket metrics
  public metricAllRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricAllRequests(props);
  }

  public metricBucketSizeBytes(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricBucketSizeBytes(props);
  }

  public metricDeleteRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricDeleteRequests(props);
  }

  public metricDownloadBytes(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricDownloadBytes(props);
  }

  public metricFirstByteLatency(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricFirstByteLatency(props);
  }

  public metricGetRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricGetRequests(props);
  }

  public metricHeadRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricHeadRequests(props);
  }

  public metricHttpRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricHttpRequests(props);
  }

  public metricListRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricListRequests(props);
  }

  public metricNumberOfObjects(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricNumberOfObjects(props);
  }

  public metricPostRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricPostRequests(props);
  }

  public metricPutRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricPutRequests(props);
  }

  public metricSelectRequests(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricSelectRequests(props);
  }

  public metricSelectScannedBytes(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricSelectScannedBytes(props);
  }

  public metricUploadBytes(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricUploadBytes(props);
  }

  public metricSelectReturnedBytes(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._bucket.metricSelectReturnedBytes(props);
  }

  // Override applyRemovalPolicy to apply to all resources
  public applyRemovalPolicy(policy: RemovalPolicy): void {
    super.applyRemovalPolicy(policy);
    this._bucket.applyRemovalPolicy(policy);
  }
}
