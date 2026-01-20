---
description: DNS and domain configuration
---

# DNS Configuration

Managing domains and DNS for Jaypie applications.

## Route 53 Setup

### Hosted Zone

Create a hosted zone for your domain:

```typescript
import { HostedZone } from "aws-cdk-lib/aws-route53";

const zone = HostedZone.fromLookup(this, "Zone", {
  domainName: "example.com",
});
```

### CloudFront Alias

Point domain to CloudFront distribution:

```typescript
import { ARecord, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";

new ARecord(this, "SiteAlias", {
  zone,
  recordName: "app",  // app.example.com
  target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
});
```

### API Gateway Custom Domain

```typescript
import { DomainName } from "aws-cdk-lib/aws-apigatewayv2";

const domainName = new DomainName(this, "ApiDomain", {
  domainName: "api.example.com",
  certificate: certificate,
});

new ARecord(this, "ApiAlias", {
  zone,
  recordName: "api",
  target: RecordTarget.fromAlias(new ApiGatewayv2DomainProperties(
    domainName.regionalDomainName,
    domainName.regionalHostedZoneId,
  )),
});
```

## Certificate Management

### ACM Certificate

```typescript
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";

const certificate = new Certificate(this, "Certificate", {
  domainName: "example.com",
  subjectAlternativeNames: ["*.example.com"],
  validation: CertificateValidation.fromDns(zone),
});
```

### Cross-Region Certificates

CloudFront requires certificates in `us-east-1`:

```typescript
// In us-east-1 stack
const cfCertificate = new Certificate(this, "CfCertificate", {
  domainName: "app.example.com",
  validation: CertificateValidation.fromDns(zone),
});

// Export ARN for use in other regions
new CfnOutput(this, "CertificateArn", {
  value: cfCertificate.certificateArn,
  exportName: "CloudFrontCertificateArn",
});
```

## Environment-Based Domains

Map environments to subdomains:

| Environment | Domain |
|-------------|--------|
| production | app.example.com |
| sandbox | sandbox.example.com |
| local | localhost:3000 |

```typescript
const subdomain = process.env.PROJECT_ENV === "production"
  ? "app"
  : process.env.PROJECT_ENV;

new ARecord(this, "Alias", {
  zone,
  recordName: subdomain,
  target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
});
```

## Debugging DNS

### Check DNS Resolution

```bash
# Check A record
dig app.example.com A

# Check CNAME
dig app.example.com CNAME

# Check with specific nameserver
dig @ns-123.awsdns-45.com app.example.com
```

### Verify Certificate

```bash
# Check certificate
openssl s_client -connect app.example.com:443 -servername app.example.com
```

## See Also

- `skill("cdk")` - CDK constructs
- `skill("aws")` - AWS integration
