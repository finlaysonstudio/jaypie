---
description: JaypieApiGateway construct and migration to JaypieDistribution
related: cdk, dns, express, lambda, streaming, variables
---

# JaypieApiGateway

`JaypieApiGateway` wraps `apiGateway.LambdaRestApi` with environment-aware domain resolution, automatic ACM certificate provisioning, Route53 alias records, and standard Jaypie tagging.

```typescript
import { JaypieApiGateway, JaypieExpressLambda } from "@jaypie/constructs";

const handler = new JaypieExpressLambda(this, "Api", {
  code: "dist/api",
  handler: "index.handler",
});

new JaypieApiGateway(this, "ApiGateway", { handler });
```

## Props

`JaypieApiGatewayProps` extends `apiGateway.LambdaRestApiProps` and adds:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `handler` | `lambda.IFunction` | required | Lambda backing the REST API (from `LambdaRestApiProps`) |
| `certificate` | `boolean \| acm.ICertificate` | `true` | `true` creates/reuses a stack-level certificate; pass an `ICertificate` to share one (e.g. from `JaypieCertificate`); `false` disables custom domain wiring |
| `host` | `string \| HostConfig` | from env | Custom domain name — see "Hostname Options" below |
| `name` | `string` | `constructEnvName("ApiGateway")` | Override the REST API name |
| `roleTag` | `string` | `CDK.ROLE.API` | Role tag applied to the API, domain, and certificate resources |
| `zone` | `string \| route53.IHostedZone` | `CDK_ENV_API_HOSTED_ZONE` | Hosted zone for DNS alias record; resolved via `resolveHostedZone` |

All remaining `LambdaRestApiProps` (e.g. `deployOptions`, `defaultCorsPreflightOptions`, `proxy`) pass through to the underlying `LambdaRestApi`.

### Side Effects

- When `host` resolves, sets `PROJECT_BASE_URL=https://${host}` on the `handler` Lambda (if it supports `addEnvironment`).
- When `host` and `zone` resolve, creates an ACM certificate (via `resolveCertificate`), attaches a custom domain, and adds an `ARecord` alias pointing at the API Gateway domain.

## Hostname Options

`host` accepts either a literal string or a `HostConfig` object that feeds `envHostname()`:

```typescript
// Literal string — used verbatim
new JaypieApiGateway(this, "Api", { handler, host: "api.example.com" });

// HostConfig — resolved via envHostname()
new JaypieApiGateway(this, "Api", {
  handler,
  host: { subdomain: "api" }, // + CDK_ENV_DOMAIN/CDK_ENV_HOSTED_ZONE + PROJECT_ENV
});
```

`HostConfig` fields (all optional, default to env vars):

| Field | Env Fallback | Notes |
|-------|--------------|-------|
| `component` | — | Extra leading label; `"@"` or `""` clears it |
| `domain` | `CDK_ENV_DOMAIN` → `CDK_ENV_HOSTED_ZONE` | Required (directly or from env); throws `ConfigurationError` if missing |
| `env` | `PROJECT_ENV` | Dropped when equal to `production` or to `CDK_ENV_PERSONAL` |
| `subdomain` | `CDK_ENV_SUBDOMAIN` | `"@"` or `""` clears it |

`envHostname` also prepends `CDK_ENV_PERSONAL` for personal builds and de-duplicates parts already present in the domain.

### Host Resolution Order

When `host` is not provided as a prop, `JaypieApiGateway` falls back to these environment variables in order:

1. `CDK_ENV_API_HOST_NAME` — used directly
2. `CDK_ENV_API_SUBDOMAIN` + `CDK_ENV_API_HOSTED_ZONE` — joined via `mergeDomain`

If neither resolves, no custom domain, certificate, or DNS record is created and the construct exposes the default execute-api URL via `.url`.

### Zone Resolution

- `props.zone` wins if provided.
- Otherwise falls back to `CDK_ENV_API_HOSTED_ZONE` (note: `JaypieApiGateway` does *not* fall back to `CDK_ENV_HOSTED_ZONE`; `JaypieDistribution` does).

## Exposed Properties

`JaypieApiGateway` implements `apiGateway.IRestApi` and surfaces:

- `api` — underlying `LambdaRestApi`
- `url` — default invoke URL
- `host` — resolved custom hostname (if any)
- `certificateArn`, `domainName`, `domainNameAliasDomainName`, `domainNameAliasHostedZoneId`
- `restApiId`, `restApiName`, `restApiRootResourceId`, `restApiRef`
- `deploymentStage`, `root`, `env`, `stack`
- `arnForExecuteApi(method, path, stage)` and the standard `metric*()` helpers

## Migrating to JaypieDistribution

`JaypieDistribution` is the preferred front door for new Jaypie APIs. It fronts the Lambda with CloudFront + Lambda Function URLs instead of API Gateway, and ships with capabilities `JaypieApiGateway` lacks:

- **WAFv2 WebACL** (managed rules + IP rate limiting + logging) by default — see `skill("cdk")`
- **Security response headers** (HSTS, CSP, X-Frame-Options, etc.) by default
- **Response streaming** via `streaming: true` (requires Lambda Function URL, not API Gateway) — see `skill("streaming")`
- **CloudFront access logs** with Datadog forwarding
- **Lower request cost** at scale (no API Gateway per-request charge)
- **IPv6** via automatic `AaaaRecord`

### Swap the Construct

```typescript
// Before
new JaypieApiGateway(this, "ApiGateway", {
  handler,
  host: { subdomain: "api" },
});

// After
new JaypieDistribution(this, "Distribution", {
  handler,
  host: { subdomain: "api" },
});
```

Both constructs accept `handler`, `host`, `zone`, `certificate`, and `roleTag` with the same semantics, and both set `PROJECT_BASE_URL` on the Lambda.

### Certificate Reuse (swap without tearing down)

No pre-work is required for the common case. `JaypieApiGateway` and `JaypieDistribution` both call `resolveCertificate()` with `certificate: true` by default, which creates the ACM cert at **stack scope** with a deterministic logical ID of `Certificate-{sanitized-domain}` cached by domain. In a single deploy that removes the gateway and adds the distribution for the same `host`, CloudFormation sees the same logical ID and preserves the cert — it simply detaches it from the API Gateway custom domain and attaches it to the new CloudFront distribution.

```typescript
// Before — first deploy
new JaypieApiGateway(this, "Api", { handler, host: "api.example.com" });

// After — next deploy, same host, cert is preserved
new JaypieDistribution(this, "Dist", { handler, host: "api.example.com" });
```

Caveats where the cert *will* be replaced:

- **Old Jaypie versions** that created the certificate as a child of `JaypieApiGateway` (pre-`resolveCertificate`). The logical ID lives under the gateway path, so removing the gateway destroys the cert.
- **Changing `host`** at the same time as the swap — different domain, different logical ID.

If you want to be explicit (or share the cert across multiple constructs), create a `JaypieCertificate` — it uses the same `resolveCertificate()` under the hood and resolves to the same stack-level logical ID:

```typescript
const cert = new JaypieCertificate(this, {
  domainName: "api.example.com",
  zone: "example.com",
});

new JaypieDistribution(this, "Dist", { handler, certificate: cert });
```

### Key Differences to Plan For

| Concern | JaypieApiGateway | JaypieDistribution |
|---------|------------------|-------------------|
| Origin | API Gateway REST | CloudFront → Function URL |
| Host env fallback | `CDK_ENV_API_HOST_NAME` → `CDK_ENV_API_SUBDOMAIN`+`CDK_ENV_API_HOSTED_ZONE` | Same, plus falls back to `CDK_ENV_HOSTED_ZONE` |
| Zone env fallback | `CDK_ENV_API_HOSTED_ZONE` | `CDK_ENV_HOSTED_ZONE` |
| DNS | A record only | A + AAAA records |
| WAF | Not built in | Enabled by default (`waf: false` to disable) |
| Security headers | Not built in | Enabled by default (`securityHeaders: false` to disable) |
| Streaming | Not supported | `streaming: true` |
| Request timeout | API Gateway 29s hard cap | CloudFront `originReadTimeout` up to 120s |
| Request/response size | API Gateway limits (10MB request) | Function URL limits (6MB request, 20MB response) — may require `SizeRestrictions_BODY` WAF override |
| Access logs | API Gateway stage logs | CloudFront logs → S3 → Datadog |
| Custom `LambdaRestApiProps` | Passed through | N/A — use `cloudfront.DistributionProps` instead |

### Gotchas

- **Lambda permissions** — `LambdaRestApi` auto-grants invoke from API Gateway; `JaypieDistribution` creates a Function URL with `authType: NONE`, so the WAF is your front-line auth/rate-limiter. Keep `waf` enabled unless you have a replacement.
- **Custom domain cutover** — swapping inside the same stack replaces the alias `ARecord`. Plan for a brief DNS propagation window.
- **Large request bodies** — the default `AWSManagedRulesCommonRuleSet` blocks bodies over 8KB. If your API accepts larger payloads, override `SizeRestrictions_BODY` — see `skill("cdk")` WAF section.
- **`LambdaRestApiProps`-only features** — usage plans, API keys, request validators, and stage variables have no CloudFront equivalent. Keep `JaypieApiGateway` if you rely on them, or move that logic into the Lambda.
- **CORS** — `defaultCorsPreflightOptions` on API Gateway is replaced by handling CORS in the Express app (see `skill("cors")`).

## See Also

- **`skill("cdk")`** — `JaypieDistribution` WAF, security headers, and other construct patterns
- **`skill("streaming")`** — response streaming via `JaypieDistribution`
- **`skill("dns")`** — hosted zones and DNS records
- **`skill("express")`** — `JaypieExpressLambda` and the Express handler wrapper
- **`skill("variables")`** — `CDK_ENV_*` environment variables reference
