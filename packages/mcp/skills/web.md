---
description: Static site and web content hosting with CloudFront, S3, and DNS
related: cdk, cicd-deploy, dns, secrets, streaming
---

# Web Hosting

Deploying static websites and web content through `@jaypie/constructs`. Pair an S3 origin with a CloudFront distribution, Route53 alias, ACM certificate, and (optionally) an OIDC deploy role for GitHub Actions — all wired up by one construct.

## Constructs

| Construct | Purpose |
|-----------|---------|
| `JaypieWebDeploymentBucket` | S3 + CloudFront + Route53 + OIDC deploy role for a static site |
| `JaypieStaticWebBucket` | Pre-configured `JaypieWebDeploymentBucket` that defaults to the `static` subdomain |
| `JaypieDistribution` | CloudFront in front of a dynamic handler (Lambda / Function URL / origin) |
| `JaypieNextJs` | Server-rendered Next.js deployment (see `skill("cdk")`) |

Use `JaypieWebDeploymentBucket` / `JaypieStaticWebBucket` for pre-built assets (SPA bundles, static docs). Use `JaypieDistribution` when CloudFront fronts an Express Lambda or streaming handler. Use `JaypieNextJs` for SSR Next.js.

## JaypieWebDeploymentBucket

Static site on S3 fronted by CloudFront, wired to Route53 and ACM. Setting `CDK_ENV_REPO` also provisions an OIDC deploy role with scoped S3 and CloudFront invalidation permissions for GitHub Actions.

```typescript
import { JaypieWebDeploymentBucket } from "@jaypie/constructs";

new JaypieWebDeploymentBucket(this, "Web", {
  host: "app.example.com",
  zone: "example.com",
});
```

### Props

| Prop | Type | Default |
|------|------|---------|
| `host` | `string \| HostConfig` | `mergeDomain(CDK_ENV_WEB_SUBDOMAIN, CDK_ENV_WEB_HOSTED_ZONE \|\| CDK_ENV_HOSTED_ZONE)` — `HostConfig` is resolved via `envHostname()` |
| `zone` | `string \| IHostedZone \| JaypieHostedZone` | `CDK_ENV_WEB_HOSTED_ZONE \|\| CDK_ENV_HOSTED_ZONE` |
| `certificate` | `boolean \| ICertificate` | `true` (creates via `resolveCertificate`) |
| `component` | `string` | `"web"` — name component for the default bucket name |
| `destination` | `LambdaDestination \| boolean` | `true` (Datadog forwarder for access-log bucket notifications) |
| `logBucket` | `IBucket \| string \| { exportName } \| true` | undefined — creates a new bucket if `destination !== false` |
| `name` | `string` | `constructEnvName(component)` |
| `responseHeadersPolicy` | `IResponseHeadersPolicy` | undefined — full override; bypasses default security headers |
| `roleTag` | `string` | `CDK.ROLE.HOSTING` |
| `securityHeaders` | `boolean \| SecurityHeadersOverrides` | `true` |
| `waf` | `boolean \| JaypieWebDeploymentBucketWafConfig` | `false` (when enabled, WAF name defaults to construct id) |

Also accepts all `s3.BucketProps` — the bucket defaults to `autoDeleteObjects: true`, `publicReadAccess: true`, `websiteIndexDocument: "index.html"`, `websiteErrorDocument: "index.html"` (SPA-friendly).

### Bucket Name

The bucket name defaults to `constructEnvName(component)`, and `component` defaults to `"web"` — a literal, independent of the construct id and of `host`. Two instances in one account and region therefore collide on `<env>-<key>-web-<nonce>` and the second stack fails change-set validation with `already exists`. Give the second instance a `component` (or a full `name`):

```typescript
new JaypieWebDeploymentBucket(this, "Web", { host: webHost, zone });
new JaypieWebDeploymentBucket(this, "App", { component: "app", host: appHost, zone });
```

Changing `component` or `name` on a deployed stack renames the bucket, which replaces it. `JaypieStaticWebBucket` sets its own default name (`constructEnvName("static")`) and does not collide.

### CloudFront

- Default behavior: S3 static website origin, `REDIRECT_TO_HTTPS`. `CACHING_DISABLED` outside production; `CACHING_OPTIMIZED` in production (`isProductionEnv()`), so hashed assets get edge cache. The response headers policy sets `Cache-Control: no-store` so browsers still revalidate.
- No `/*` behavior is created. Paths registered afterward with `distribution.addBehavior("/app/*", origin)` are evaluated ahead of the default behavior and match in every environment — a static site and a Lambda surface can share one distribution.
- Access logs land in a CloudFront log bucket with Datadog forwarding by default. Set `destination: false` to skip notifications, or pass `logBucket: <existing>` to reuse a bucket.

```typescript
const web = new JaypieWebDeploymentBucket(this, "Web", { host, zone });
web.distribution!.addBehavior("/app/*", new origins.FunctionUrlOrigin(api.functionUrl));
```

### Security Headers

Same defaults as `JaypieDistribution`: HSTS, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy, Cross-Origin-* headers, and Server header removal (applied via a `ResponseHeadersPolicy` on the default behavior). Override the same way:

```typescript
// Disable
new JaypieWebDeploymentBucket(this, "Web", { host, zone, securityHeaders: false });

// Override specific headers
new JaypieWebDeploymentBucket(this, "Web", {
  host, zone,
  securityHeaders: {
    contentSecurityPolicy: "default-src 'self';",
    frameOption: HeadersFrameOption.SAMEORIGIN,
  },
});

// Full custom policy
new JaypieWebDeploymentBucket(this, "Web", { host, zone, responseHeadersPolicy: myPolicy });
```

### WAF

Off by default, matching `JaypieDistribution`. When enabled it uses the same settings (AWSManagedRulesCommonRuleSet, AWSManagedRulesKnownBadInputsRuleSet, IP rate limit 2000/5min, WAF logging to S3 with Datadog forwarding). The WebACL and WAF log bucket are namespaced with the construct id so multiple instances coexist without collision:

```typescript
// Default — no WAF
new JaypieWebDeploymentBucket(this, "Web", { host, zone });

// Enable — WAF named after construct id ("MyWeb-WebAcl")
new JaypieWebDeploymentBucket(this, "MyWeb", { host, zone, waf: true });

// Custom name + rate limit
new JaypieWebDeploymentBucket(this, "Web", {
  host, zone,
  waf: { name: "static", rateLimitPerIp: 500 },
});

// Existing WebACL
new JaypieWebDeploymentBucket(this, "Web", {
  host, zone,
  waf: { webAclArn: "arn:aws:wafv2:..." },
});
```

### DNS

Creates an A record alias to the distribution. Tags the record with `CDK.ROLE.NETWORKING`.

### Deploy Role (OIDC)

When `CDK_ENV_REPO` is set (e.g., `finlaysonstudio/jaypie`), the construct creates an IAM role assumed via GitHub OIDC with:

- `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject`, `s3:ListObjectsV2` on the bucket
- `s3:ListBucket` on the bucket
- `cloudformation:DescribeStacks` on the owning stack (so workflows can read outputs)
- `cloudfront:CreateInvalidation` on the distribution

Exposed as `CfnOutput`s for workflow consumption:

| Output | Contents |
|--------|----------|
| `DestinationBucketName` | Target bucket for `aws s3 sync` |
| `DestinationBucketDeployRoleArn` | Role ARN for `aws-actions/configure-aws-credentials` |
| `DistributionId` | CloudFront distribution for `aws cloudfront create-invalidation` |
| `CertificateArn` | ACM certificate ARN (when a certificate is created) |

By default these outputs live inside the construct, so CDK adds the parent path and a hash suffix (e.g., `WebDestinationBucketNameB89ADFD6`). To get stable, hash-free logical IDs in `cdk-outputs.json`, call `exportOutputs()`:

```typescript
const web = new JaypieWebDeploymentBucket(this, "Web", { host, zone });
web.exportOutputs();
// → DestinationBucketName, DestinationBucketDeployRoleArn, DistributionId, CertificateArn
```

For stacks with multiple `JaypieWebDeploymentBucket` instances, pass a `prefix` to avoid collisions:

```typescript
appWeb.exportOutputs({ prefix: "App" });   // AppDestinationBucketName, ...
docsWeb.exportOutputs({ prefix: "Docs" }); // DocsDestinationBucketName, ...
```

See `skill("cicd-actions")` for the `web-deploy` composite action that reads these outputs and deploys content, and `skill("cicd-deploy")` for where it sits in the workflow.

## JaypieStaticWebBucket

`JaypieWebDeploymentBucket` with `static` as the default subdomain. Use for a "static.example.com" asset site sharing the project's hosted zone.

```typescript
import { JaypieStaticWebBucket } from "@jaypie/constructs";

// Minimal — host defaults to `envHostname({ subdomain: "static" })`,
// zone defaults to CDK_ENV_DOMAIN || CDK_ENV_HOSTED_ZONE
new JaypieStaticWebBucket(this, "Static");

// Override host/zone when needed
new JaypieStaticWebBucket(this, "Docs", {
  host: "docs.example.com",
  zone: "example.com",
});
```

The default `name` is `constructEnvName("static")` so the bucket is namespaced per environment.

## Environment-Aware Hosts

`envHostname()` resolves a hostname from `PROJECT_ENV`, producing apex for production and a prefixed subdomain otherwise.

```typescript
import { envHostname, JaypieStaticWebBucket } from "@jaypie/constructs";

// production → "jaypie.net"
// sandbox    → "sandbox.jaypie.net"
// development → "development.jaypie.net"
const host = envHostname({ domain: "jaypie.net" });

new JaypieStaticWebBucket(this, "Bucket", { host, zone: "jaypie.net" });
```

See `skill("variables")` for the `PROJECT_ENV` / `CDK_ENV_*` variables involved.

## JaypieDistribution (dynamic origins)

For CloudFront in front of an Express Lambda, Function URL, or custom origin — not a static S3 site — reach for `JaypieDistribution`. It ships with ACM, Route53 alias, and security headers by default; WAF is opt-in via `waf: true`.

```typescript
import { JaypieDistribution, JaypieExpressLambda } from "@jaypie/constructs";

const api = new JaypieExpressLambda(this, "Api", {
  code: "../api/dist",
  handler: "index.handler",
});

new JaypieDistribution(this, "Distribution", {
  handler: api,
  host: "api.example.com",
  zone: "example.com",
});
```

Security headers (`ResponseHeadersPolicy`) and WAFv2 WebACL are covered in `skill("cdk")`. Response streaming with `createLambdaStreamHandler` is covered in `skill("streaming")`.

### Certificate Sharing

`resolveCertificate` caches certificates at the stack level by domain, so swapping `JaypieDistribution` ↔ `JaypieApiGateway` on the same hostname does not tear down or recreate the certificate. For explicit control:

```typescript
import { JaypieCertificate, JaypieDistribution } from "@jaypie/constructs";

const cert = new JaypieCertificate(this, "ApiCert", {
  domainName: "api.example.com",
  zone: "example.com",
});

new JaypieDistribution(this, "Dist", { handler: api, certificate: cert });
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CDK_ENV_HOSTED_ZONE` | Default hosted zone for all web constructs |
| `CDK_ENV_WEB_HOSTED_ZONE` | Override hosted zone for web buckets specifically |
| `CDK_ENV_WEB_SUBDOMAIN` | Subdomain under the hosted zone |
| `CDK_ENV_WEB_HOST` | Full host override (skips subdomain + zone composition) |
| `CDK_ENV_REPO` | `owner/repo` — when set, provisions the OIDC deploy role |
| `CDK_ENV_DOMAIN` | Default domain for `JaypieStaticWebBucket` zone resolution |

See `skill("variables")` for the full environment variable reference.

## Deployment Workflow

A typical `feat/*` branch deploy:

1. CDK deploys the bucket, distribution, and deploy role.
2. Workflow reads `DestinationBucketName`, `DestinationBucketDeployRoleArn`, and `DistributionId` from stack outputs.
3. Workflow assumes the deploy role, runs `aws s3 sync ./dist s3://$BUCKET`, then invalidates `/*` on the distribution.

Steps 2 and 3 are the `web-deploy` composite action in `skill("cicd-actions")`. `skill("cicd-deploy")` shows it running immediately after `cdk-deploy`.

## Stack Example

```typescript
import { Construct } from "constructs";
import {
  envHostname,
  JaypieAppStack,
  JaypieStaticWebBucket,
} from "@jaypie/constructs";

export class DocumentationStack extends JaypieAppStack {
  public readonly bucket: JaypieStaticWebBucket;

  constructor(scope: Construct, id?: string) {
    super(scope, id ?? "JaypieDocumentationStack", { key: "documentation" });

    const zone = process.env.CDK_ENV_HOSTED_ZONE ?? "example.com";
    const host = envHostname({ domain: zone });

    this.bucket = new JaypieStaticWebBucket(this, "DocumentationBucket", {
      host,
      zone,
    });
  }
}
```

## See Also

- **`skill("cdk")`** — core constructs, `JaypieDistribution` WAF and security headers, `JaypieNextJs`
- **`skill("cicd-actions")`** — the `web-deploy` action that syncs assets and invalidates the distribution
- **`skill("cicd-deploy")`** — workflows that consume `DestinationBucketName` / `DeployRoleArn` / `DistributionId`
- **`skill("dns")`** — hosted zones, ACM certificates, DNS debugging
- **`skill("secrets")`** — `JaypieEnvSecret` provider/consumer pattern
- **`skill("streaming")`** — `JaypieDistribution` streaming configuration
- **`skill("variables")`** — environment variable reference
