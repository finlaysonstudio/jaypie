import { isIP } from "node:net";

import { ConfigurationError } from "@jaypie/errors";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

//
//
// Constants
//

const DEFAULT_RATE_LIMIT = 2000;
const IP_ADDRESS_VERSION = {
  4: "IPV4",
  6: "IPV6",
} as const;
const MAX_PREFIX_LENGTH = { 4: 32, 6: 128 } as const;
const RATE_LIMIT_RULE_NAME = "RateLimitPerIp";

//
//
// Types
//

/**
 * Per-IP rate limit for a WAF WebACL. `exemptIps` lists CIDRs the rate-based
 * rule neither counts nor blocks; every other source address is limited at
 * `perIp` requests per 5-minute window.
 */
export interface JaypieWafRateLimit {
  /** IPv4 and IPv6 CIDRs excluded from the per-IP rate rule */
  exemptIps?: string[];
  /**
   * Requests per IP per 5-minute window
   * @default 2000
   */
  perIp?: number;
}

//
//
// Helpers
//

function ipVersion(cidr: string): 4 | 6 {
  const [address, prefix, ...rest] = cidr.split("/");
  const version = isIP(address ?? "");
  const prefixLength = Number(prefix);
  if (
    rest.length > 0 ||
    (version !== 4 && version !== 6) ||
    prefix === undefined ||
    !/^\d+$/.test(prefix) ||
    prefixLength > MAX_PREFIX_LENGTH[version]
  ) {
    throw new ConfigurationError(
      `waf.rateLimit.exemptIps entry "${cidr}" is not a valid IPv4 or IPv6 CIDR (for example "203.0.113.10/32" or "2001:db8::/48")`,
    );
  }
  return version;
}

//
//
// Main
//

/**
 * Builds the `RateLimitPerIp` rule. With `exemptIps`, creates one `CfnIPSet`
 * per address family (WAF requires separate sets) and scopes the rate-based
 * statement down to requests from outside them. Without, the rule matches the
 * historical shape exactly.
 */
export function wafRateLimitRule({
  exemptIps = [],
  perIp = DEFAULT_RATE_LIMIT,
  priority,
  scope,
}: {
  exemptIps?: string[];
  perIp?: number;
  priority: number;
  scope: Construct;
}): wafv2.CfnWebACL.RuleProperty {
  const byVersion: Record<4 | 6, string[]> = { 4: [], 6: [] };
  for (const cidr of exemptIps) {
    byVersion[ipVersion(cidr)].push(cidr);
  }

  const exemptStatements: wafv2.CfnWebACL.StatementProperty[] = (
    [4, 6] as const
  )
    .filter((version) => byVersion[version].length > 0)
    .map((version) => {
      const ipSet = new wafv2.CfnIPSet(
        scope,
        `RateLimitExemptIpv${version}Set`,
        {
          addresses: [...new Set(byVersion[version])],
          ipAddressVersion: IP_ADDRESS_VERSION[version],
          scope: "CLOUDFRONT",
        },
      );
      return { ipSetReferenceStatement: { arn: ipSet.attrArn } };
    });

  const scopeDownStatement: wafv2.CfnWebACL.StatementProperty | undefined =
    exemptStatements.length === 0
      ? undefined
      : {
          notStatement: {
            statement:
              exemptStatements.length === 1
                ? exemptStatements[0]
                : { orStatement: { statements: exemptStatements } },
          },
        };

  return {
    name: RATE_LIMIT_RULE_NAME,
    priority,
    action: { block: {} },
    statement: {
      rateBasedStatement: {
        aggregateKeyType: "IP",
        limit: perIp,
        ...(scopeDownStatement && { scopeDownStatement }),
      },
    },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName: RATE_LIMIT_RULE_NAME,
      sampledRequestsEnabled: true,
    },
  };
}

/**
 * Resolves `waf.rateLimit` and the older `waf.rateLimitPerIp` into one
 * `JaypieWafRateLimit`. Setting both limits is ambiguous and throws.
 */
export function resolveWafRateLimit({
  rateLimit,
  rateLimitPerIp,
}: {
  rateLimit?: JaypieWafRateLimit;
  rateLimitPerIp?: number;
} = {}): JaypieWafRateLimit {
  if (rateLimit?.perIp !== undefined && rateLimitPerIp !== undefined) {
    throw new ConfigurationError(
      "Set waf.rateLimit.perIp or waf.rateLimitPerIp, not both",
    );
  }
  return {
    exemptIps: rateLimit?.exemptIps,
    perIp: rateLimit?.perIp ?? rateLimitPerIp,
  };
}
