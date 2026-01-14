import { CfnOutput, Fn, RemovalPolicy, Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

import { CDK } from "./constants";
import {
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  resolveCertificate,
  resolveHostedZone,
} from "./helpers";

// Check if environment is a consumer (personal/ephemeral builds import from sandbox)
function checkEnvIsConsumer(env = process.env): boolean {
  return (
    env.PROJECT_ENV === CDK.ENV.PERSONAL ||
    !!env.CDK_ENV_PERSONAL ||
    env.PROJECT_ENV === "ephemeral" ||
    !!env.CDK_ENV_EPHEMERAL
  );
}

// Check if environment is a provider (sandbox exports for consumers)
function checkEnvIsProvider(env = process.env): boolean {
  return env.PROJECT_ENV === CDK.ENV.SANDBOX;
}

// Sanitize export name to only allow alphanumeric, colons, and hyphens
function cleanName(name: string): string {
  return name.replace(/[^a-zA-Z0-9:-]/g, "");
}

// Generate export name based on environment
function exportEnvName(name: string, env = process.env): string {
  const projectKey = env.PROJECT_KEY || "default";
  let rawName;
  if (checkEnvIsProvider(env)) {
    rawName = `env-${env.PROJECT_ENV}-${projectKey}-cert-${name}`;
  } else if (checkEnvIsConsumer(env)) {
    rawName = `env-${CDK.ENV.SANDBOX}-${projectKey}-cert-${name}`;
  } else {
    rawName = `env-${env.PROJECT_ENV || "default"}-${projectKey}-cert-${name}`;
  }
  return cleanName(rawName);
}

// Resolve domain name from props or environment (called before super)
function resolveDomainNameFromProps(
  props?: JaypieCertificateProps,
): string | undefined {
  if (props?.domainName) {
    return props.domainName;
  }
  if (process.env.CDK_ENV_API_HOST_NAME) {
    return process.env.CDK_ENV_API_HOST_NAME;
  }
  if (process.env.CDK_ENV_API_SUBDOMAIN) {
    return mergeDomain(
      process.env.CDK_ENV_API_SUBDOMAIN,
      process.env.CDK_ENV_API_HOSTED_ZONE ||
        process.env.CDK_ENV_HOSTED_ZONE ||
        "",
    );
  }
  return undefined;
}

// Sanitize domain for construct ID
function sanitizeDomain(domain: string): string {
  return domain.replace(/\./g, "-");
}

export interface JaypieCertificateProps {
  /**
   * Import certificate from a provider stack instead of creating one.
   * Auto-detected from PROJECT_ENV (personal/ephemeral = consumer).
   * @default auto-detected from environment
   */
  consumer?: boolean;
  /**
   * The domain name for the certificate.
   * @default Derived from CDK_ENV_API_HOST_NAME or CDK_ENV_API_SUBDOMAIN + CDK_ENV_API_HOSTED_ZONE
   */
  domainName?: string;
  /**
   * Export name override for cross-stack sharing.
   * @default Generated from environment and domain
   */
  export?: string;
  /**
   * Construct ID override. When not provided, ID is auto-generated from domain.
   * Use this to align with certificates created by other constructs.
   * @default Auto-generated as "Certificate-{sanitized-domain}"
   */
  id?: string;
  /**
   * Export certificate ARN for other stacks to import.
   * Auto-detected from PROJECT_ENV (sandbox = provider).
   * @default auto-detected from environment
   */
  provider?: boolean;
  /**
   * Role tag for tagging the certificate.
   * @default CDK.ROLE.API
   */
  roleTag?: string;
  /**
   * The hosted zone for DNS validation.
   * @default CDK_ENV_API_HOSTED_ZONE || CDK_ENV_HOSTED_ZONE
   */
  zone?: string | route53.IHostedZone;
}

/**
 * A standalone certificate construct that can be shared across constructs.
 *
 * Key feature: Uses the same `resolveCertificate()` helper as JaypieDistribution,
 * JaypieApiGateway, etc. This means:
 * - Certificates are created at the stack level and cached by domain
 * - You can "take over" a certificate from another construct by using the same domain
 * - Swapping between JaypieDistribution and JaypieApiGateway won't recreate certs
 *
 * Supports flexible constructor signatures:
 * - `new JaypieCertificate(scope)` - uses environment defaults
 * - `new JaypieCertificate(scope, props)` - ID auto-generated from domain
 * - `new JaypieCertificate(scope, id, props)` - explicit ID
 *
 * @example
 * // Minimal - uses environment variables for domain/zone
 * const cert = new JaypieCertificate(this);
 *
 * @example
 * // With options - ID auto-generated as "JaypieCert-api-example-com"
 * const cert = new JaypieCertificate(this, {
 *   domainName: "api.example.com",
 *   zone: "example.com",
 * });
 *
 * @example
 * // Explicit ID - useful when you need a specific construct ID
 * const cert = new JaypieCertificate(this, "MyApiCert", {
 *   domainName: "api.example.com",
 *   zone: "example.com",
 * });
 *
 * @example
 * // Take over from JaypieDistribution (uses same ID format)
 * // After removing JaypieDistribution with certificate: true
 * const cert = new JaypieCertificate(this, {
 *   domainName: "api.example.com",
 *   zone: "example.com",
 * });
 *
 * @example
 * // Provider/consumer pattern for cross-stack sharing
 * // In sandbox stack:
 * new JaypieCertificate(this, { provider: true });
 *
 * // In personal build:
 * new JaypieCertificate(this, { consumer: true });
 */
export class JaypieCertificate extends Construct implements acm.ICertificate {
  public readonly certificate: acm.ICertificate;
  public readonly certificateArn: string;
  public readonly domainName: string;

  /**
   * Create a certificate with environment defaults.
   */
  constructor(scope: Construct);
  /**
   * Create a certificate with options (ID auto-generated from domain).
   */
  constructor(scope: Construct, props: JaypieCertificateProps);
  /**
   * Create a certificate with explicit ID.
   */
  constructor(scope: Construct, id: string, props?: JaypieCertificateProps);
  constructor(
    scope: Construct,
    idOrProps?: string | JaypieCertificateProps,
    maybeProps?: JaypieCertificateProps,
  ) {
    // Resolve constructor arguments
    let id: string;
    let props: JaypieCertificateProps;

    if (typeof idOrProps === "string") {
      // (scope, id, props) pattern
      id = idOrProps;
      props = maybeProps || {};
    } else if (typeof idOrProps === "object" && idOrProps !== null) {
      // (scope, props) pattern - auto-generate id
      props = idOrProps;
      const domainName = resolveDomainNameFromProps(props);
      if (domainName) {
        // Use "JaypieCert-" prefix to avoid collision with internal certificate
        id = props.id || `JaypieCert-${sanitizeDomain(domainName)}`;
      } else {
        id = props.id || "JaypieCert";
      }
    } else {
      // (scope) pattern - no id, no props
      props = {};
      const domainName = resolveDomainNameFromProps(props);
      if (domainName) {
        id = `JaypieCert-${sanitizeDomain(domainName)}`;
      } else {
        id = "JaypieCert";
      }
    }

    super(scope, id);

    const {
      consumer = checkEnvIsConsumer(),
      domainName: propsDomainName,
      export: exportParam,
      provider = checkEnvIsProvider(),
      roleTag = CDK.ROLE.API,
      zone: propsZone,
    } = props;

    // Validate environment variables
    if (
      process.env.CDK_ENV_API_SUBDOMAIN &&
      !isValidSubdomain(process.env.CDK_ENV_API_SUBDOMAIN)
    ) {
      throw new Error("CDK_ENV_API_SUBDOMAIN is not a valid subdomain");
    }

    if (
      process.env.CDK_ENV_API_HOSTED_ZONE &&
      !isValidHostname(process.env.CDK_ENV_API_HOSTED_ZONE)
    ) {
      throw new Error("CDK_ENV_API_HOSTED_ZONE is not a valid hostname");
    }

    if (
      process.env.CDK_ENV_HOSTED_ZONE &&
      !isValidHostname(process.env.CDK_ENV_HOSTED_ZONE)
    ) {
      throw new Error("CDK_ENV_HOSTED_ZONE is not a valid hostname");
    }

    // Determine domain name from props or environment
    let domainName = propsDomainName;
    if (!domainName) {
      if (process.env.CDK_ENV_API_HOST_NAME) {
        domainName = process.env.CDK_ENV_API_HOST_NAME;
      } else if (process.env.CDK_ENV_API_SUBDOMAIN) {
        domainName = mergeDomain(
          process.env.CDK_ENV_API_SUBDOMAIN,
          process.env.CDK_ENV_API_HOSTED_ZONE ||
            process.env.CDK_ENV_HOSTED_ZONE ||
            "",
        );
      }
    }

    if (!domainName) {
      throw new Error(
        "domainName is required for JaypieCertificate (or set CDK_ENV_API_HOST_NAME / CDK_ENV_API_SUBDOMAIN)",
      );
    }

    if (!isValidHostname(domainName)) {
      throw new Error("domainName is not a valid hostname");
    }

    this.domainName = domainName;

    // Determine zone from props or environment
    const zone =
      propsZone ||
      process.env.CDK_ENV_API_HOSTED_ZONE ||
      process.env.CDK_ENV_HOSTED_ZONE;

    // Generate export name
    const sanitizedDomain = domainName.replace(/\./g, "-");
    const exportName = exportParam
      ? cleanName(exportParam)
      : exportEnvName(sanitizedDomain);

    if (consumer) {
      // Import certificate ARN from provider stack
      const certificateArn = Fn.importValue(exportName);
      this.certificate = acm.Certificate.fromCertificateArn(
        this,
        "ImportedCertificate",
        certificateArn,
      );
      this.certificateArn = certificateArn;

      new CfnOutput(this, "ConsumedCertificateArn", {
        value: this.certificateArn,
      });
    } else {
      // Create or get cached certificate at stack level
      if (!zone) {
        throw new Error(
          "zone is required for JaypieCertificate when not consuming (or set CDK_ENV_API_HOSTED_ZONE / CDK_ENV_HOSTED_ZONE)",
        );
      }

      const hostedZone = resolveHostedZone(this, { zone });

      // Use resolveCertificate to create at stack level (enables sharing)
      const cert = resolveCertificate(this, {
        certificate: true,
        domainName,
        roleTag,
        zone: hostedZone,
      });

      if (!cert) {
        throw new Error("Failed to create certificate");
      }

      this.certificate = cert;
      this.certificateArn = cert.certificateArn;

      if (provider) {
        new CfnOutput(this, "ProvidedCertificateArn", {
          value: this.certificateArn,
          exportName,
        });
      } else {
        new CfnOutput(this, "CertificateArn", {
          value: this.certificateArn,
        });
      }
    }
  }

  // IResource implementation
  public get stack(): Stack {
    return Stack.of(this);
  }

  public get env(): { account: string; region: string } {
    return {
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    };
  }

  public applyRemovalPolicy(policy: RemovalPolicy): void {
    this.certificate.applyRemovalPolicy(policy);
  }

  // ICertificate implementation
  public metricDaysToExpiry(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this.certificate.metricDaysToExpiry(props);
  }
}
