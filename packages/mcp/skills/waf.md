---
description: WAF (Web Application Firewall) configuration for JaypieDistribution
related: aws, cdk, web
---

# WAF (Web Application Firewall)

`JaypieDistribution` (and `JaypieWebDeploymentBucket`) attach a WAFv2 WebACL by
default with:

- **AWSManagedRulesCommonRuleSet** — OWASP top 10 (SQLi, XSS, etc.)
- **AWSManagedRulesKnownBadInputsRuleSet** — known bad patterns (Log4j, etc.)
- **Rate limiting** — 2000 requests per 5 minutes per IP
- **WAF logging** — S3 bucket with Datadog forwarder notifications

```typescript
// Default: WAF enabled with logging
new JaypieDistribution(this, "Dist", { handler });

// Disable WAF entirely
new JaypieDistribution(this, "Dist", { handler, waf: false });

// Customize rate limit (name required on any waf config object)
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { name: "api", rateLimitPerIp: 500 },
});

// Multiple distributions in one env — set a unique waf.name on each to
// avoid WebACL/S3 bucket name collisions between stacks.
new JaypieDistribution(this, "Api", { handler: api, waf: { name: "api" } });
new JaypieDistribution(this, "Mcp", { handler: mcp, waf: { name: "mcp" } });

// Use existing WebACL
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { name: "api", webAclArn: "arn:aws:wafv2:..." },
});

// Disable WAF logging only
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { name: "api", logBucket: false },
});

// Bring your own WAF logging bucket
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { name: "api", logBucket: myWafBucket },
});
```

Cost: $5/month per WebACL + $1/month per rule + $0.60 per million requests. Use
`waf: false` to opt out.

## Override specific managed rule actions

Flip a named sub-rule from `block` to `count` everywhere (e.g. allow large
request bodies):

```typescript
new JaypieDistribution(this, "Dist", {
  handler,
  waf: {
    name: "api",
    managedRuleOverrides: {
      AWSManagedRulesCommonRuleSet: [
        { name: "SizeRestrictions_BODY", actionToUse: { count: {} } },
      ],
    },
  },
});
```

## Scope a managed rule group to specific URL patterns

```typescript
new JaypieDistribution(this, "Dist", {
  handler,
  waf: {
    name: "api",
    managedRuleScopeDowns: {
      // Only run the CommonRuleSet for paths OTHER than /chat — lets /chat
      // handle large AI-generated request bodies without weakening protection
      // elsewhere.
      AWSManagedRulesCommonRuleSet: {
        notStatement: {
          statement: {
            byteMatchStatement: {
              fieldToMatch: { uriPath: {} },
              positionalConstraint: "STARTS_WITH",
              searchString: "/chat",
              textTransformations: [{ priority: 0, type: "NONE" }],
            },
          },
        },
      },
    },
  },
});
```

## Relaxing a managed rule for specific paths — `waf.allow`

`allow` relaxes named rules to **count** mode for matching paths, leaving full
blocking everywhere else. Each entry names one or more paths and, per managed
rule group key, the sub-rule names to flip:

```typescript
new JaypieDistribution(this, "Dist", {
  handler,
  waf: {
    name: "api",
    allow: [
      {
        path: "/hooks/*", // trailing * → STARTS_WITH; otherwise EXACTLY
        AWSManagedRulesCommonRuleSet: ["NoUserAgent_HEADER"],
        AWSManagedRulesKnownBadInputsRuleSet: ["ExploitablePaths_URIPATH"],
      },
    ],
  },
});
```

- A `path` ending in `*` compiles to a `STARTS_WITH` byte-match; otherwise
  `EXACTLY`. `/hooks/*` matches `/hooks/ping` but **not** bare `/hooks`.
- The key (e.g. `AWSManagedRulesCommonRuleSet`) must be one of the active
  `managedRules`.
- `allow` composes with `managedRuleOverrides`: the baseline overrides apply to
  both the relaxed and strict emissions of a group; entries in `allow` further
  relax specific (path × sub-rule) intersections. Groups not named in `allow`
  keep their single-rule emission.

## ⚠️ Rule name ≠ label (casing trap)

AWS uses different casing for a rule's **label** (seen in WAF logs) and its
**name**. `managedRuleOverrides` / `allow` match on the **rule name**:

| Label (seen in WAF logs)                              | Rule name (use this) |
| ----------------------------------------------------- | -------------------- |
| `awswaf:managed:aws:core-rule-set:NoUserAgent_Header` | `NoUserAgent_HEADER` |

Jaypie now validates rule names against each AWS managed rule group at synth and
throws a `ConfigurationError` listing the valid names on a mismatch (custom rule
groups are not validated). Historically a name that matched no rule was
**silently ignored** — the rule kept blocking. If a relaxation "isn't working,"
read the WAF log `terminatingRule.<NAME>` and copy that exact name (e.g.
`NoUserAgent_HEADER`, `SizeRestrictions_BODY`, `UserAgent_BadBots_HEADER`).

## See Also

- **`skill("cdk")`** - CDK constructs and deployment patterns
- **`skill("aws")`** - AWS SDK utilities
- **`skill("web")`** - JaypieWebDeploymentBucket and JaypieStaticWebBucket
