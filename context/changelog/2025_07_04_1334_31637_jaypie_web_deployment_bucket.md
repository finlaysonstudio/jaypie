# Jaypie Web Deployment Bucket

packages/constructs/src/index.ts
https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.Bucket.html
https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.IBucket.html

I would like to create a new construct, JaypieWebDeploymentBucket:

```typescript
const deploymentBucket = new JaypieWebDeploymentBucket(this, {
  certificate?: boolean || ICertificate || true,
  host?: String || process.env.CDK_ENV_WEB_HOST || mergeDomain(
    process.env.CDK_ENV_WEB_SUBDOMAIN,
    CDK_ENV_WEB_HOSTED_ZONE || process.env.CDK_ENV_HOSTED_ZONE,
  ) || false, // if merge domain throws
  name?: String,
  roleTag?: string || CDK.ROLE.HOSTING;
  zone?: string || IHostedZone || process.env.CDK_ENV_WEB_HOSTED_ZONE || process.env.CDK_ENV_HOSTED_ZONE,

  // ...any s3.Bucket props
})
```

Check CDK_ENV_WEB_SUBDOMAIN with isValidSubdomain.
Check CDK_ENV_WEB_HOST with isValidHostname (if it is set).
Check the result of mergeDomain with isValidHostname if CDK_ENV_WEB_SUBDOMAIN is set and isValidSubdomain and CDK_ENV_WEB_HOSTED_ZONE or CDK_ENV_HOSTED_ZONE.

This is a good pattern for validation (maybe make it a function):

```typescript
if (
  process.env.CDK_ENV_WEB_HOSTED_ZONE &&
  !isValidHostname(process.env.CDK_ENV_WEB_HOSTED_ZONE)
) {
  throw new ConfigurationError(
    "CDK_ENV_WEB_HOSTED_ZONE is not a valid hostname",
  );
}
```

Create a function, `isEnv(env: String)` that checks `process.env.PROJECT_ENV === env`.
Create conveniences, `isProductionEnv()` that checks `CDK.ENV.PRODUCTION` and `isSandboxEnv()` that checks `CDK.ENV.SANDBOX`.

The construct should implement the following code (which is a jumbled mess and pseudo code in places, please clean it up to meet the standards of other files):

```typescript
import {
  CDK,
  cfnOutput,
  ConfigurationError,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
} from "@jaypie/cdk";

import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  Tags,
} from "aws-cdk-lib";
import acm from "aws-cdk-lib/aws-certificatemanager";
import cloudfront from "aws-cdk-lib/aws-cloudfront";
import origins from "aws-cdk-lib/aws-cloudfront-origins";
import {
  Effect,
  FederatedPrincipal,
  Role,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import route53 from "aws-cdk-lib/aws-route53";
import route53Targets from "aws-cdk-lib/aws-route53-targets";
import s3 from "aws-cdk-lib/aws-s3";

if (process.env.CDK_ENV_REPO) {
  repo = `repo:${process.env.CDK_ENV_REPO}:*`;
}

const destinationBucket = new s3.Bucket(this, "DestinationBucket", {
  accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
  autoDeleteObjects: true,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
  publicReadAccess: true,
  removalPolicy: RemovalPolicy.DESTROY,
  versioned: false,
  websiteErrorDocument: "index.html",
  websiteIndexDocument: "index.html",
});
Tags.of(destinationBucket).add(CDK.TAG.ROLE, CDK.ROLE.HOSTING);

if (repo) {
  // Create an IAM role for GitHub Actions to assume
  const bucketDeployRole = new Role(this, "DestinationBucketDeployRole", {
    assumedBy: new FederatedPrincipal(
      Fn.importValue(CDK.IMPORT.OIDC_PROVIDER),
      {
        StringLike: {
          "token.actions.githubusercontent.com:sub": repo,
        },
      },
      "sts:AssumeRoleWithWebIdentity", // sts:AssumeRoleWithWebIdentity
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
      resources: [`${destinationBucket.bucketArn}/*`],
    }),
  );
  bucketDeployRole.addToPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [`${destinationBucket.bucketArn}`],
    }),
  );

  // Allow the role to deploy CDK apps
  bucketDeployRole.addToPolicy(
    new PolicyStatement({
      actions: ["cloudformation:DescribeStacks"],
      effect: Effect.ALLOW,
      resources: ["*"], // TODO: restrict to this stack
    }),
  );
}

//
//
// Static Builds
//

let certificate;
let distribution;

if (host && zone) {
  const hostedZone = zone if IHostedZone || route53.HostedZone.fromLookup(this, "HostedZone", {
    domainName: zone if String,
  });

  certificate = new acm.Certificate(this, "Certificate", {
    domainName: host,
    validation: acm.CertificateValidation.fromDns(hostedZone),
  });
  output.CertificateArn = certificate.certificateArn;
  Tags.of(certificate).add(CDK.TAG.ROLE, CDK.ROLE.HOSTING);

  distribution = new cloudfront.Distribution(this, "Distribution", {
    defaultBehavior: {
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      origin: new origins.S3Origin(destinationBucket),
      viewerProtocolPolicy:
        cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
    certificate,
    domainNames: [host],
  });
  Tags.of(distribution).add(CDK.TAG.ROLE, CDK.ROLE.HOSTING);

  // If this is production, enable caching on everything but index.html
  if (isProductionEnv()) {
    // Add behavior for all other paths
    distribution.addBehavior(
      "/*",
      new origins.S3Origin(destinationBucket),
      {
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    );
  }

  const record = new route53.ARecord(this, "AliasRecord", {
    recordName: host,
    target: route53.RecordTarget.fromAlias(
      new route53Targets.CloudFrontTarget(distribution),
    ),
    zone: hostedZone,
  });
  Tags.of(record).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
}
```

It should implement IBucket

Be sure to add the following properties:
deployRoleArn = bucketDeployRole.roleArn
distributionDomainName = distribution.distributionDomainName if available

Also, output `bucketDeployRole.roleArn` as `DestinationBucketDeployRoleArn`.
If it is possible to output that at the "top level" so it can be accessed as DestinationBucketDeployRoleArn and not a nested value that would be ideal.
