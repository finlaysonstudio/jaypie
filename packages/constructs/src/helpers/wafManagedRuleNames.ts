import { ConfigurationError } from "@jaypie/errors";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";

/**
 * Canonical sub-rule names for each AWS managed rule group, as published in the
 * AWS WAF developer guide. Used to validate `waf.allow` and
 * `waf.managedRuleOverrides` rule names at synth time — AWS WAF matches
 * `RuleActionOverride` on the exact rule *name* and silently ignores names that
 * match no rule, so a typo or a label/name casing mismatch (e.g. the label
 * `…:NoUserAgent_Header` vs the rule name `NoUserAgent_HEADER`) becomes an
 * undiagnosable no-op.
 *
 * Groups absent from this map (custom rule groups, or AWS groups not yet
 * mirrored here) are not validated.
 *
 * @see https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
 */
export const AWS_MANAGED_RULE_GROUPS: Record<string, readonly string[]> = {
  AWSManagedRulesAdminProtectionRuleSet: ["AdminProtection_URIPATH"],
  AWSManagedRulesAmazonIpReputationList: [
    "AWSManagedIPDDoSList",
    "AWSManagedIPReputationList",
    "AWSManagedReconnaissanceList",
  ],
  AWSManagedRulesAnonymousIpList: ["AnonymousIPList", "HostingProviderIPList"],
  AWSManagedRulesCommonRuleSet: [
    "CrossSiteScripting_BODY",
    "CrossSiteScripting_COOKIE",
    "CrossSiteScripting_QUERYARGUMENTS",
    "CrossSiteScripting_URIPATH",
    "EC2MetaDataSSRF_BODY",
    "EC2MetaDataSSRF_COOKIE",
    "EC2MetaDataSSRF_QUERYARGUMENTS",
    "EC2MetaDataSSRF_URIPATH",
    "GenericLFI_BODY",
    "GenericLFI_QUERYARGUMENTS",
    "GenericLFI_URIPATH",
    "GenericRFI_BODY",
    "GenericRFI_QUERYARGUMENTS",
    "GenericRFI_URIPATH",
    "NoUserAgent_HEADER",
    "RestrictedExtensions_QUERYARGUMENTS",
    "RestrictedExtensions_URIPATH",
    "SizeRestrictions_BODY",
    "SizeRestrictions_Cookie_HEADER",
    "SizeRestrictions_QUERYSTRING",
    "SizeRestrictions_URIPATH",
    "UserAgent_BadBots_HEADER",
  ],
  AWSManagedRulesKnownBadInputsRuleSet: [
    "ExploitablePaths_URIPATH",
    "Host_localhost_HEADER",
    "JavaDeserializationRCE_BODY",
    "JavaDeserializationRCE_HEADER",
    "JavaDeserializationRCE_QUERYSTRING",
    "JavaDeserializationRCE_URIPATH",
    "Log4JRCE_BODY",
    "Log4JRCE_HEADER",
    "Log4JRCE_QUERYSTRING",
    "Log4JRCE_URIPATH",
    "PROPFIND_METHOD",
    "ReactJSRCE_BODY",
  ],
  AWSManagedRulesLinuxRuleSet: ["LFI_HEADER", "LFI_QUERYSTRING", "LFI_URIPATH"],
  AWSManagedRulesPHPRuleSet: [
    "PHPHighRiskMethodsVariables_BODY",
    "PHPHighRiskMethodsVariables_HEADER",
    "PHPHighRiskMethodsVariables_QUERYSTRING",
    "PHPHighRiskMethodsVariables_URIPATH",
  ],
  AWSManagedRulesSQLiRuleSet: [
    "SQLiExtendedPatterns_BODY",
    "SQLiExtendedPatterns_HEADER",
    "SQLiExtendedPatterns_QUERYARGUMENTS",
    "SQLiExtendedPatterns_URIPATH",
    "SQLi_BODY",
    "SQLi_COOKIE",
    "SQLi_QUERYARGUMENTS",
    "SQLi_URIPATH",
  ],
  AWSManagedRulesUnixRuleSet: [
    "UNIXShellCommandsVariables_BODY",
    "UNIXShellCommandsVariables_HEADER",
    "UNIXShellCommandsVariables_QUERYSTRING",
  ],
  AWSManagedRulesWindowsRuleSet: [
    "PowerShellCommands_BODY",
    "PowerShellCommands_COOKIE",
    "PowerShellCommands_QUERYARGUMENTS",
    "WindowsShellCommands_BODY",
    "WindowsShellCommands_HEADER",
    "WindowsShellCommands_QUERYARGUMENTS",
    "WindowsShellCommands_QUERYSTRING",
    "WindowsShellCommands_URIPATH",
  ],
  AWSManagedRulesWordPressRuleSet: [
    "WordPressExploitableCommands_QUERYSTRING",
    "WordPressExploitablePaths_URIPATH",
  ],
};

/** One entry in a `waf.allow` list. Mirrors JaypieWafAllowEntry structurally. */
interface WafAllowEntryLike {
  path: string | string[];
  [ruleGroupKey: string]: string | string[] | undefined;
}

interface AssertValidWafRuleNamesOptions {
  allow?: WafAllowEntryLike | WafAllowEntryLike[];
  managedRuleOverrides?: Record<
    string,
    wafv2.CfnWebACL.RuleActionOverrideProperty[]
  >;
}

/**
 * Throw a ConfigurationError if any `waf.allow` or `waf.managedRuleOverrides`
 * rule name does not exist in its AWS managed rule group. Groups not present in
 * AWS_MANAGED_RULE_GROUPS (custom groups) are skipped. A name that matches no
 * rule would otherwise be silently ignored by AWS WAF.
 */
export function assertValidWafRuleNames({
  allow,
  managedRuleOverrides,
}: AssertValidWafRuleNamesOptions = {}): void {
  // Collect (group → referenced rule name) pairs from both inputs.
  const references: Array<{ group: string; ruleName: string }> = [];

  if (managedRuleOverrides) {
    for (const [group, overrides] of Object.entries(managedRuleOverrides)) {
      for (const override of overrides ?? []) {
        if (override?.name) references.push({ group, ruleName: override.name });
      }
    }
  }

  const allowEntries = allow ? (Array.isArray(allow) ? allow : [allow]) : [];
  for (const entry of allowEntries) {
    for (const key of Object.keys(entry)) {
      if (key === "path") continue;
      const raw = entry[key];
      if (raw == null) continue;
      const ruleNames = Array.isArray(raw) ? raw : [raw];
      for (const ruleName of ruleNames) {
        references.push({ group: key, ruleName });
      }
    }
  }

  for (const { group, ruleName } of references) {
    const validNames = AWS_MANAGED_RULE_GROUPS[group];
    if (!validNames) continue; // Unknown/custom group — cannot validate
    if (!validNames.includes(ruleName)) {
      throw new ConfigurationError(
        `WAF rule "${ruleName}" is not a rule in ${group}. AWS WAF matches ` +
          `RuleActionOverrides on the exact rule name and silently ignores ` +
          `unmatched names (note the label/name casing trap, e.g. ` +
          `"NoUserAgent_HEADER" not "NoUserAgent_Header"). Valid rule names: ` +
          `${validNames.join(", ")}.`,
      );
    }
  }
}
