import { Duration, Stack } from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sesActions from "aws-cdk-lib/aws-ses-actions";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";
import { envHostname } from "./helpers/envHostname";
import { resolveHostedZone } from "./helpers/resolveHostedZone";
import { JaypieDnsRecord } from "./JaypieDnsRecord.js";
import {
  JaypieBucketQueuedLambda,
  JaypieBucketQueuedLambdaProps,
} from "./JaypieBucketQueuedLambda.js";

export interface JaypieSesIntakeProps extends Partial<JaypieBucketQueuedLambdaProps> {
  /**
   * Make this the account/region's active receipt rule set.
   *
   * CloudFormation has no activation resource, so activation runs through an
   * `AwsCustomResource`. Deletion must deactivate: SES refuses to delete an
   * active rule set, and the stack would otherwise be undeletable. That means
   * tearing this construct down disables SES receiving for the whole
   * account/region, not just this domain.
   *
   * @default true
   */
  activate?: boolean;
  /**
   * Destination for received mail. Accepts a `JaypieBucketQueuedLambda` (its
   * `.bucket` is unwrapped) or a raw `s3.IBucket`. Omit to have the construct
   * create a `JaypieBucketQueuedLambda` from `code` and `handler`.
   */
  bucket?: s3.IBucket | JaypieBucketQueuedLambda;
  /**
   * Create the three DKIM CNAME records. Their resolution IS SESv2 domain
   * verification; no TXT record is involved. Disable only when the records are
   * managed elsewhere, in which case the identity stays unverified until they
   * exist and SES rejects mail for the domain.
   *
   * @default true
   */
  dkim?: boolean;
  /**
   * Fully-qualified receiving domain.
   * @default envHostname({ component: "intake" })
   */
  host?: string;
  /**
   * Create the MX record pointing at the region's inbound SMTP endpoint.
   * @default true
   */
  mx?: boolean;
  /**
   * S3 key prefix for stored messages.
   * @default CDK.SES.INTAKE.OBJECT_KEY_PREFIX ("inbound/")
   */
  objectKeyPrefix?: string;
  /**
   * Recipient addresses or domains the receipt rule matches.
   * @default [host] — every local part on the receiving domain
   */
  recipients?: string[];
  /**
   * Explicit receipt rule set name.
   * @default CloudFormation-generated
   */
  ruleSetName?: string;
  /**
   * Run SES spam and virus scanning, adding the verdict headers.
   * @default true
   */
  scanEnabled?: boolean;
  /**
   * TTL for the DKIM CNAME records.
   * @default CDK.SES.DKIM.TTL (30 minutes)
   */
  ttl?: Duration | number;
  /**
   * Hosted zone owning the DKIM and MX records.
   * @default process.env.CDK_ENV_HOSTED_ZONE
   */
  zone?: string | route53.IHostedZone;
}

/**
 * Unwrap a `JaypieBucketQueuedLambda` to the real `s3.Bucket` it wraps.
 *
 * `sesActions.S3` locates the bucket's `Policy` child to attach the
 * `ses.amazonaws.com` + `aws:SourceAccount` grant and the CloudFormation
 * ordering dependency. Handed the wrapper construct, that lookup misses and the
 * action degrades to a warning with no policy and no dependency, so received
 * mail fails to write. Duck-typed rather than `instanceof` so a duplicated
 * `@jaypie/constructs` in the dependency tree still unwraps.
 */
function unwrapBucketQueuedLambda(
  bucket: s3.IBucket | JaypieBucketQueuedLambda,
): JaypieBucketQueuedLambda | undefined {
  const candidate = (bucket as JaypieBucketQueuedLambda).bucket;
  if (candidate && (candidate as unknown) !== (bucket as unknown)) {
    return bucket as JaypieBucketQueuedLambda;
  }
  return undefined;
}

/**
 * SES inbound email receiving: domain identity, DKIM and MX records, a receipt
 * rule set writing raw MIME to S3, and rule-set activation.
 *
 * ```typescript
 * // Owns the worker
 * new JaypieSesIntake(this, "Intake", {
 *   code: "../api/dist",
 *   handler: "email.handler",
 *   tables: [table],
 *   zone: "example.com",
 * });
 *
 * // Attaches to an existing worker
 * new JaypieSesIntake(this, "Intake", { bucket: worker, zone: "example.com" });
 * ```
 *
 * SES allows ONE active receipt rule set per account/region. Gate instantiation
 * so exactly one environment per AWS account owns receiving.
 *
 * SES sandbox mode restricts sending only; receiving needs no production-access
 * request.
 */
export class JaypieSesIntake extends Construct {
  private readonly _bucket: s3.IBucket;
  private readonly _host: string;
  private readonly _identity: ses.EmailIdentity;
  private readonly _rule: ses.ReceiptRule;
  private readonly _ruleSet: ses.ReceiptRuleSet;
  private readonly _worker?: JaypieBucketQueuedLambda;

  constructor(scope: Construct, id: string, props: JaypieSesIntakeProps = {}) {
    super(scope, id);

    const {
      activate = true,
      bucket,
      dkim = true,
      host,
      mx = true,
      objectKeyPrefix = CDK.SES.INTAKE.OBJECT_KEY_PREFIX,
      recipients,
      ruleSetName,
      scanEnabled = true,
      ttl = CDK.SES.DKIM.TTL,
      zone,
      ...workerProps
    } = props;

    this._host =
      host ||
      envHostname({
        component: CDK.SES.INTAKE.COMPONENT,
        ...(typeof zone === "string" && { domain: zone }),
      });

    // =========================================================================
    // Destination — either the caller's bucket or a worker this construct owns
    // =========================================================================
    if (bucket) {
      this._worker = unwrapBucketQueuedLambda(bucket);
      this._bucket = this._worker
        ? this._worker.bucket
        : (bucket as s3.IBucket);
    } else {
      if (!workerProps.code) {
        throw new ConfigurationError(
          "JaypieSesIntake requires either `bucket` or `code` to receive mail",
        );
      }
      this._worker = new JaypieBucketQueuedLambda(this, "Worker", {
        handler: "index.handler",
        roleTag: CDK.ROLE.PROCESSING,
        ...workerProps,
        code: workerProps.code,
      } as JaypieBucketQueuedLambdaProps);
      this._bucket = this._worker.bucket;
    }

    // =========================================================================
    // Domain identity + DNS
    //
    // `Identity.domain()` creates no DNS records, and `Identity.publicHostedZone()`
    // would verify the apex instead of the subdomain, so the DKIM CNAMEs are
    // created here. `CfnRecordSet` rather than the L2 record: the L2's name
    // qualification cannot handle the identity's unresolved tokens (the same
    // pattern CDK's own `EasyDkim.bind` uses).
    // =========================================================================
    this._identity = new ses.EmailIdentity(this, "Identity", {
      identity: ses.Identity.domain(this._host),
    });

    if (dkim || mx) {
      const hostedZone = resolveHostedZone(this, { name: "Zone", zone });

      if (dkim) {
        const ttlSeconds = (
          typeof ttl === "number" ? Duration.seconds(ttl) : ttl
        ).toSeconds();
        const dkimTokens: Array<[string, string]> = [
          [this._identity.dkimDnsTokenName1, this._identity.dkimDnsTokenValue1],
          [this._identity.dkimDnsTokenName2, this._identity.dkimDnsTokenValue2],
          [this._identity.dkimDnsTokenName3, this._identity.dkimDnsTokenValue3],
        ];
        dkimTokens.forEach(([name, value], index) => {
          new route53.CfnRecordSet(this, `Dkim${index + 1}`, {
            hostedZoneId: hostedZone.hostedZoneId,
            name,
            resourceRecords: [value],
            ttl: String(ttlSeconds),
            type: CDK.DNS.RECORD.CNAME,
          });
        });
      }

      if (mx) {
        new JaypieDnsRecord(this, "Mx", {
          recordName: this._host,
          type: CDK.DNS.RECORD.MX,
          values: [
            {
              hostName: `${CDK.SES.SMTP_HOSTNAME_PREFIX}.${Stack.of(this).region}.amazonaws.com`,
              priority: 10,
            },
          ],
          zone: hostedZone,
        });
      }
    }

    // =========================================================================
    // Receipt rule set — every matching recipient lands in the bucket
    // =========================================================================
    this._ruleSet = new ses.ReceiptRuleSet(this, "RuleSet", {
      ...(ruleSetName && { receiptRuleSetName: ruleSetName }),
    });
    this._rule = this._ruleSet.addRule("Intake", {
      actions: [
        new sesActions.S3({
          bucket: this._bucket,
          objectKeyPrefix,
        }),
      ],
      recipients: recipients || [this._host],
      scanEnabled,
    });
    // Mail cannot be accepted for an unverified identity
    this._rule.node.addDependency(this._identity);

    if (activate) {
      const physicalResourceId = cr.PhysicalResourceId.of(
        `activate-${this.node.path}`,
      );
      const parameters = {
        RuleSetName: this._ruleSet.receiptRuleSetName,
      };
      const activation = new cr.AwsCustomResource(this, "ActivateRuleSet", {
        onCreate: {
          action: "setActiveReceiptRuleSet",
          parameters,
          physicalResourceId,
          service: "SES",
        },
        onDelete: {
          action: "setActiveReceiptRuleSet",
          // No RuleSetName deactivates; an active rule set cannot be deleted
          parameters: {},
          service: "SES",
        },
        onUpdate: {
          action: "setActiveReceiptRuleSet",
          parameters,
          physicalResourceId,
          service: "SES",
        },
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
          resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      });
      activation.node.addDependency(this._rule);
    }
  }

  /** Bucket receiving raw MIME from the receipt rule */
  public get bucket(): s3.IBucket {
    return this._bucket;
  }

  /** Fully-qualified receiving domain */
  public get host(): string {
    return this._host;
  }

  /** SES domain identity, verified by the DKIM CNAMEs */
  public get identity(): ses.EmailIdentity {
    return this._identity;
  }

  /** The receipt rule writing to the bucket */
  public get rule(): ses.ReceiptRule {
    return this._rule;
  }

  /** The receipt rule set; one per account/region may be active */
  public get ruleSet(): ses.ReceiptRuleSet {
    return this._ruleSet;
  }

  /**
   * The bucket/queue/Lambda worker, when this construct created one or was
   * handed a `JaypieBucketQueuedLambda`
   */
  public get worker(): JaypieBucketQueuedLambda | undefined {
    return this._worker;
  }
}
