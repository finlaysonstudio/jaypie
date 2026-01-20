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
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";
import {
  constructEnvName,
  isProductionEnv,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  resolveCertificate,
} from "./helpers";
import { JaypieHostedZone } from "./JaypieHostedZone";

export interface JaypieWebDeploymentBucketProps extends s3.BucketProps {
  /**
   * SSL certificate for the CloudFront distribution
   * @default true (creates a new certificate)
   */
  certificate?: boolean | acm.ICertificate;
  /**
   * The domain name for the website
   * @default mergeDomain(CDK_ENV_WEB_SUBDOMAIN, CDK_ENV_WEB_HOSTED_ZONE || CDK_ENV_HOSTED_ZONE)
   */
  host?: string;
  /**
   * Optional bucket name
   */
  name?: string;
  /**
   * Role tag for tagging resources
   * @default CDK.ROLE.HOSTING
   */
  roleTag?: string;
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

  constructor(
    scope: Construct,
    id: string,
    props: JaypieWebDeploymentBucketProps = {},
  ) {
    super(scope, id);

    const roleTag = props.roleTag || CDK.ROLE.HOSTING;

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
    let host = props.host;
    if (!host) {
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
      props.zone ||
      process.env.CDK_ENV_WEB_HOSTED_ZONE ||
      process.env.CDK_ENV_HOSTED_ZONE;

    // Create the S3 bucket
    this.bucket = new s3.Bucket(this, "DestinationBucket", {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
      bucketName: props.name || constructEnvName("web"),
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
      websiteErrorDocument: "index.html",
      websiteIndexDocument: "index.html",
      ...props,
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

    if (repo) {
      const bucketDeployRole = new Role(this, "DestinationBucketDeployRole", {
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
        certificate: props.certificate,
        domainName: host,
        roleTag,
        zone: hostedZone,
      });

      if (this.certificate) {
        new CfnOutput(this, "CertificateArn", {
          value: this.certificate.certificateArn,
        });
      }

      // Create CloudFront distribution
      this.distribution = new cloudfront.Distribution(this, "Distribution", {
        defaultBehavior: {
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          origin: new origins.S3StaticWebsiteOrigin(this.bucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        certificate: this.certificate,
        domainNames: [host],
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
    }
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
