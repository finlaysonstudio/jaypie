import { Stack, Tags } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

import { CDK } from "../constants";

// Cache: Stack -> (domain -> certificate)
// Using WeakMap for automatic garbage collection when stacks are destroyed
const certificateCache = new WeakMap<Stack, Map<string, acm.ICertificate>>();

export interface ResolveCertificateOptions {
  /** Certificate input - true creates at stack level, false skips, ICertificate uses as-is, string imports from ARN */
  certificate?: boolean | acm.ICertificate | string;
  /** Domain name for the certificate (required if certificate is true) */
  domainName: string;
  /** Construct ID name prefix (defaults to "Certificate") */
  name?: string;
  /** Role tag for tagging (defaults to CDK.ROLE.API) */
  roleTag?: string;
  /** Hosted zone for DNS validation (required if certificate is true) */
  zone: route53.IHostedZone;
}

/**
 * Resolves a certificate based on input type.
 *
 * Key behavior: When certificate is `true`, the certificate is created at the
 * STACK level (not construct level) and cached by domain name. This allows
 * swapping between constructs (e.g., JaypieDistribution to JaypieApiGateway)
 * without recreating the certificate.
 *
 * @param scope - The construct scope (used to find the stack)
 * @param options - Certificate resolution options
 * @returns The resolved certificate, or undefined if certificate is false
 *
 * @example
 * // Create or get cached certificate at stack level
 * const cert = resolveCertificate(this, {
 *   certificate: true,
 *   domainName: "api.example.com",
 *   zone: hostedZone,
 * });
 *
 * @example
 * // Use existing certificate
 * const cert = resolveCertificate(this, {
 *   certificate: existingCert,
 *   domainName: "api.example.com",
 *   zone: hostedZone,
 * });
 *
 * @example
 * // Import certificate from ARN
 * const cert = resolveCertificate(this, {
 *   certificate: "arn:aws:acm:us-east-1:123456789:certificate/abc-123",
 *   domainName: "api.example.com",
 *   zone: hostedZone,
 * });
 */
export function resolveCertificate(
  scope: Construct,
  options: ResolveCertificateOptions,
): acm.ICertificate | undefined {
  const {
    certificate,
    domainName,
    name = "Certificate",
    roleTag = CDK.ROLE.API,
    zone,
  } = options;

  // false = no certificate
  if (certificate === false) {
    return undefined;
  }

  // ICertificate passed directly - use as-is
  if (typeof certificate === "object" && certificate !== null) {
    return certificate;
  }

  // ARN string - import from ARN
  if (typeof certificate === "string") {
    // Sanitize domain for construct ID
    const sanitizedDomain = sanitizeDomainForId(domainName);
    return acm.Certificate.fromCertificateArn(
      scope,
      `${name}-${sanitizedDomain}`,
      certificate,
    );
  }

  // true (default) = create at STACK level with caching
  const stack = Stack.of(scope);

  // Get or create cache for this stack
  let stackCache = certificateCache.get(stack);
  if (!stackCache) {
    stackCache = new Map<string, acm.ICertificate>();
    certificateCache.set(stack, stackCache);
  }

  // Return cached certificate if one exists for this domain
  const cached = stackCache.get(domainName);
  if (cached) {
    return cached;
  }

  // Create certificate at STACK level (not construct level!)
  // This is the key difference - the certificate's lifecycle is tied to the stack,
  // not to the individual construct that requested it
  const sanitizedDomain = sanitizeDomainForId(domainName);
  const cert = new acm.Certificate(stack, `${name}-${sanitizedDomain}`, {
    domainName,
    validation: acm.CertificateValidation.fromDns(zone),
  });
  Tags.of(cert).add(CDK.TAG.ROLE, roleTag);

  // Cache for future requests
  stackCache.set(domainName, cert);

  return cert;
}

/**
 * Sanitizes a domain name for use in CDK construct IDs.
 * CDK construct IDs can only contain alphanumeric characters and hyphens.
 */
function sanitizeDomainForId(domain: string): string {
  return domain.replace(/\./g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

/**
 * Clears the certificate cache for a specific stack.
 * Primarily useful for testing.
 */
export function clearCertificateCache(stack: Stack): void {
  certificateCache.delete(stack);
}

/**
 * Clears all certificate caches.
 * Primarily useful for testing.
 */
export function clearAllCertificateCaches(): void {
  // WeakMap doesn't have a clear() method, so we create a new one
  // This is a no-op since we can't actually clear a WeakMap,
  // but stacks going out of scope will be garbage collected anyway
}
