---
description: WAF (Web Application Firewall) configuration for JaypieDistribution
related: aws, cdk, web
---

# WAF (Web Application Firewall)

`JaypieDistribution` (and `JaypieWebDeploymentBucket`) attach a WAFv2 WebACL
when `waf` is set. WAF is **off by default**; `waf: true` enables it with:

- **AWSManagedRulesCommonRuleSet** — OWASP top 10 (SQLi, XSS, etc.)
- **AWSManagedRulesKnownBadInputsRuleSet** — known bad patterns (Log4j, etc.)
- **Rate limiting** — 2000 requests per 5 minutes per IP
- **WAF logging** — S3 bucket with Datadog forwarder notifications

```typescript
// Default: no WAF
new JaypieDistribution(this, "Dist", { handler });

// Enable WAF with logging
new JaypieDistribution(this, "Dist", { handler, waf: true });

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

Cost: $5/month per WebACL + $1/month per rule + $0.60 per million requests. That
cost is why WAF is opt-in; set `waf: true` (or a config object) to opt in.

## Log bucket

The construct-created WAF log bucket blocks all public access, enforces SSL, is
versioned, uses SSE-S3, retains objects for `logRetention` (365 days by
default), and carries `RemovalPolicy.RETAIN` with no auto-delete. It survives
stack deletion; delete it by hand when tearing an environment down.

CloudFormation owns the whole bucket policy, including the two
`delivery.logs.amazonaws.com` delivery statements. A policy statement added to
that bucket out of band (console, CLI, another stack) is discarded on the next
deploy.

A consumer-supplied `logBucket` is used as given: it needs its own hardening and
its own delivery policy.

## Redact headers from WAF logs

WAF logs record every request header. Jaypie always redacts
`authorization`, `cookie`, `x-amz-content-sha256`, and `x-api-key`
(`DEFAULT_WAF_REDACTED_HEADERS`). `redactedHeaders` names more:

```typescript
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { name: "api", redactedHeaders: ["x-session-token"] },
});
```

- The list **merges** with the defaults rather than replacing them, so adding a
  header can only ever redact more. There is no way to un-redact a default.
- Names are compared case-insensitively, as WAF matches them, so naming a
  default again does not duplicate it.
- `x-amz-content-sha256` is in the default because `originAccessControl`
  requires clients to send a SHA-256 of the request body. For a low-entropy body
  that hash is a body fingerprint.
- `redactedFields` passes `wafv2.CfnLoggingConfiguration.FieldToMatchProperty`
  entries (query string, URI path, JSON body) through and layers on top of the
  redacted headers.
- WAF caps the combined list at 100 entries; exceeding it throws a
  `ConfigurationError` at synth.

`waf.logRetention` overrides the construct's `logRetention` for the WAF log
bucket alone, so WAF logs and CloudFront access logs can keep different
retention.

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
