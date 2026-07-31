---
description: SES inbound email receiving with JaypieSesIntake
related: aws, cdk, dns, lambda, sqs
---

# Inbound Email

`JaypieSesIntake` packages SES inbound email receiving: a subdomain identity,
its DKIM CNAMEs, an MX record, a receipt rule set writing raw MIME to S3, and
rule-set activation.

```typescript
import { JaypieSesIntake } from "@jaypie/constructs";

new JaypieSesIntake(this, "Intake", {
  code: "../api/dist",
  handler: "email.handler",
  tables: [table],
  zone: "example.com",
});
```

The construct builds a `JaypieBucketQueuedLambda` from the Lambda props it is
given: SES writes each message to S3, the bucket's `OBJECT_CREATED` notification
queues it, and the worker parses the MIME.

To attach to a worker built elsewhere, pass `bucket` instead:

```typescript
const worker = new JaypieBucketQueuedLambda(this, "EmailWorker", { ... });

new JaypieSesIntake(this, "Intake", { bucket: worker, zone: "example.com" });
```

`bucket` accepts the `JaypieBucketQueuedLambda` wrapper or a raw `s3.IBucket`;
the wrapper is unwrapped internally (see "The wrapper trap" below).

## Props

| Prop | Default | Description |
|------|---------|-------------|
| `activate` | `true` | Make this the account/region's active receipt rule set |
| `bucket` | — | Existing destination; omit to have the construct build a worker from `code` |
| `dkim` | `true` | Create the three DKIM CNAMEs |
| `host` | `envHostname({ component: "intake" })` | Fully-qualified receiving domain |
| `mx` | `true` | Create the MX record |
| `objectKeyPrefix` | `"inbound/"` | S3 key prefix for stored messages |
| `recipients` | `[host]` | Recipients the rule matches |
| `ruleSetName` | CloudFormation-generated | Explicit rule set name |
| `scanEnabled` | `true` | Run SES spam and virus scanning |
| `ttl` | 1800 | TTL for the DKIM CNAMEs |
| `zone` | `CDK_ENV_HOSTED_ZONE` | Hosted zone owning DKIM and MX |

All `JaypieBucketQueuedLambdaProps` pass through to the worker the construct
creates (`code`, `handler`, `tables`, `secrets`, `timeout`, `dlq`, and so on).

Accessors: `bucket`, `host`, `identity`, `rule`, `ruleSet`, `worker`.

## Operational Constraints

**One active receipt rule set per account/region.** Gate instantiation so
exactly one environment per AWS account owns receiving — an environment
variable checked in `app.ts` is the usual approach. A second stack that
activates its own rule set silently takes over from the first.

**Teardown disables receiving account-wide.** CloudFormation has no rule-set
activation resource, so activation runs through an `AwsCustomResource` whose
`onDelete` deactivates. It has to: SES refuses to delete an active rule set, so
without deactivation the stack is undeletable. The consequence is that deleting
this stack turns off SES receiving for the whole account/region, not just this
domain.

**SES sandbox mode restricts sending only.** Receiving needs no
production-access request.

## Why the DNS Records Are Hand-Built

`Identity.domain(subdomain)` creates no DNS records. `Identity.publicHostedZone(zone)`
does, but it verifies the zone apex rather than the subdomain, which is the
wrong identity. So the construct creates the three DKIM CNAMEs itself.

They are `CfnRecordSet`, not the L2 `CnameRecord`: the L2's name qualification
cannot handle the identity's unresolved tokens. This is the same pattern CDK's
own `EasyDkim.bind` uses.

Those CNAMEs resolving **is** SESv2 identity verification. There is no TXT
record in this flow. Until they resolve, SES rejects mail for the domain.

## The Wrapper Trap

`sesActions.S3` must receive the real `s3.Bucket`. It locates the bucket's
`Policy` child to attach the `ses.amazonaws.com` + `aws:SourceAccount` grant and
the CloudFormation ordering dependency. Handed a `JaypieBucketQueuedLambda` (an
`IBucket` by delegation, but not the bucket itself), the lookup misses and the
action degrades to a synth-time warning with no policy and no dependency —
received mail then fails to write.

`JaypieSesIntake` unwraps `bucket` for you. Reaching for `sesActions.S3`
directly means passing `worker.bucket`, never `worker`.

## Handler

The worker receives SQS records wrapping S3 event notifications. Read the object
to get raw MIME, then parse.

```typescript
import { getMessages } from "@jaypie/aws";

export const handler = lambdaHandler(async ({ event }) => {
  for (const message of getMessages(event)) {
    for (const record of message.Records ?? []) {
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
      // fetch from process.env.CDK_ENV_BUCKET_NAME, parse MIME, file the message
    }
  }
});
```

Pair `dlq` with the worker so unparseable MIME stops after `maxReceiveCount`
instead of retrying until retention lapses. Without it, per-record `try/catch`
is the only defense, and it swallows transient failures too. See `skill("sqs")`.

## See Also

- **`skill("cdk")`** — construct catalog
- **`skill("dns")`** — hosted zones and record management
- **`skill("sqs")`** — queue constructs and dead-letter queues
