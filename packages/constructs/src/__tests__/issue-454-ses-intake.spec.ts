/* eslint-disable vitest/expect-expect */
// Template.hasResourceProperties and resourceCountIs assert; the rule cannot see it

import { App, Duration, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "../constants";
import { JaypieBucketQueuedLambda } from "../JaypieBucketQueuedLambda.js";
import { JaypieSesIntake } from "../JaypieSesIntake.js";

const CODE = lambda.Code.fromInline("exports.handler = () => {}");
const HOST = "intake.example.com";

// Every input envHostname reads, so the derived host does not depend on
// whatever the ambient environment happens to set (CI sets PROJECT_ENV)
const HOSTNAME_ENV_KEYS = [
  "CDK_ENV_DOMAIN",
  "CDK_ENV_HOSTED_ZONE",
  "CDK_ENV_PERSONAL",
  "CDK_ENV_SUBDOMAIN",
  "PROJECT_ENV",
] as const;

describe("issue 454: JaypieSesIntake", () => {
  let app: App;
  let stack: Stack;
  let zone: HostedZone;
  let priorEnv: Record<string, string | undefined>;

  beforeEach(() => {
    priorEnv = Object.fromEntries(
      HOSTNAME_ENV_KEYS.map((key) => [key, process.env[key]]),
    );
    HOSTNAME_ENV_KEYS.forEach((key) => delete process.env[key]);
    process.env.CDK_ENV_HOSTED_ZONE = "example.com";
    app = new App();
    stack = new Stack(app, "TestStack", {
      env: { account: "123456789012", region: "us-east-1" },
    });
    zone = new HostedZone(stack, "Zone", { zoneName: "example.com" });
  });

  afterEach(() => {
    HOSTNAME_ENV_KEYS.forEach((key) => {
      const value = priorEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  describe("Base Cases", () => {
    it("is a Construct", () => {
      expect(JaypieSesIntake).toBeFunction();
    });

    it("creates identity, DNS, rule set, and activation", () => {
      const construct = new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        handler: "email.handler",
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.host).toBe(HOST);
      template.hasResourceProperties("AWS::SES::EmailIdentity", {
        EmailIdentity: HOST,
      });
      template.resourceCountIs("AWS::SES::ReceiptRuleSet", 1);
      template.resourceCountIs("AWS::SES::ReceiptRule", 1);
      template.resourceCountIs("Custom::AWS", 1);
      // Three DKIM CNAMEs plus the MX record
      template.resourceCountIs("AWS::Route53::RecordSet", 4);
    });
  });

  describe("Error Conditions", () => {
    it("throws when neither bucket nor code is provided", () => {
      expect(
        () => new JaypieSesIntake(stack, "Intake", { host: HOST, zone }),
      ).toThrow(ConfigurationError);
    });
  });

  describe("Features", () => {
    it("creates its own worker from code and handler", () => {
      const construct = new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        handler: "email.handler",
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.worker).toBeDefined();
      expect(construct.bucket).toBe(construct.worker!.bucket);
      template.resourceCountIs("AWS::S3::Bucket", 1);
      template.resourceCountIs("AWS::SQS::Queue", 1);
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "email.handler",
      });
    });

    it("passes worker props through, including dlq", () => {
      const construct = new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        dlq: 3,
        handler: "email.handler",
        host: HOST,
        timeout: Duration.seconds(60),
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.worker!.dlq).toBeDefined();
      template.resourceCountIs("AWS::SQS::Queue", 2);
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: 60,
      });
    });

    it("attaches to an existing JaypieBucketQueuedLambda", () => {
      const worker = new JaypieBucketQueuedLambda(stack, "Worker", {
        code: CODE,
        handler: "email.handler",
      });
      const construct = new JaypieSesIntake(stack, "Intake", {
        bucket: worker,
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      expect(construct.worker).toBe(worker);
      expect(construct.bucket).toBe(worker.bucket);
      template.resourceCountIs("AWS::S3::Bucket", 1);
    });

    it("unwraps the wrapper so the S3 action attaches a bucket policy", () => {
      const worker = new JaypieBucketQueuedLambda(stack, "Worker", {
        code: CODE,
        handler: "email.handler",
      });
      new JaypieSesIntake(stack, "Intake", {
        bucket: worker,
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      // The action degrades to a warning with no policy when handed the wrapper
      const [policy] = Object.values(
        template.findResources("AWS::S3::BucketPolicy"),
      );
      const sesStatement = (
        policy as any
      ).Properties.PolicyDocument.Statement.find(
        (statement: any) =>
          statement.Principal?.Service === CDK.PRINCIPAL.SES ||
          statement.Principal?.Service?.[0] === CDK.PRINCIPAL.SES,
      );
      expect(sesStatement).toBeDefined();
      expect(sesStatement.Condition.StringEquals["aws:SourceAccount"]).toEqual({
        Ref: "AWS::AccountId",
      });
    });

    it("accepts a raw bucket", () => {
      const bucket = new s3.Bucket(stack, "Raw");
      const construct = new JaypieSesIntake(stack, "Intake", {
        bucket,
        host: HOST,
        zone,
      });

      expect(construct.bucket).toBe(bucket);
      expect(construct.worker).toBeUndefined();
    });

    it("writes under the inbound prefix by default", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SES::ReceiptRule", {
        Rule: {
          Actions: [
            {
              S3Action: {
                ObjectKeyPrefix: CDK.SES.INTAKE.OBJECT_KEY_PREFIX,
              },
            },
          ],
          Recipients: [HOST],
          ScanEnabled: true,
        },
      });
    });

    it("honors objectKeyPrefix, recipients, and scanEnabled", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        host: HOST,
        objectKeyPrefix: "raw/",
        recipients: ["support@example.com"],
        scanEnabled: false,
        zone,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SES::ReceiptRule", {
        Rule: {
          Actions: [{ S3Action: { ObjectKeyPrefix: "raw/" } }],
          Recipients: ["support@example.com"],
          ScanEnabled: false,
        },
      });
    });

    it("creates three DKIM CNAMEs at the configured TTL", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      const records = Object.values(
        template.findResources("AWS::Route53::RecordSet"),
      );
      const cnames = records.filter(
        (record: any) => record.Properties.Type === CDK.DNS.RECORD.CNAME,
      );
      expect(cnames).toHaveLength(CDK.SES.DKIM.RECORD_COUNT);
      cnames.forEach((record: any) => {
        expect(record.Properties.TTL).toBe(String(CDK.SES.DKIM.TTL));
      });
    });

    it("accepts a numeric ttl", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        host: HOST,
        ttl: 60,
        zone,
      });
      const template = Template.fromStack(stack);

      const cnames = Object.values(
        template.findResources("AWS::Route53::RecordSet"),
      ).filter(
        (record: any) => record.Properties.Type === CDK.DNS.RECORD.CNAME,
      );
      cnames.forEach((record: any) => {
        expect(record.Properties.TTL).toBe("60");
      });
    });

    it("points MX at the region inbound SMTP endpoint", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: `${HOST}.`,
        ResourceRecords: ["10 inbound-smtp.us-east-1.amazonaws.com"],
        Type: CDK.DNS.RECORD.MX,
      });
    });

    it("skips DKIM and MX when disabled", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        dkim: false,
        host: HOST,
        mx: false,
        zone,
      });
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::Route53::RecordSet", 0);
    });

    it("skips activation when activate is false", () => {
      new JaypieSesIntake(stack, "Intake", {
        activate: false,
        code: CODE,
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      template.resourceCountIs("Custom::AWS", 0);
    });

    it("deactivates on delete so the stack can be torn down", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      const custom = Object.values(template.findResources("Custom::AWS"))[0];
      const onDelete = JSON.parse((custom as any).Properties.Delete);
      expect(onDelete.action).toBe("setActiveReceiptRuleSet");
      expect(onDelete.parameters).toEqual({});
    });

    it("names the rule set when ruleSetName is provided", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        host: HOST,
        ruleSetName: "test-rule-set",
        zone,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SES::ReceiptRuleSet", {
        RuleSetName: "test-rule-set",
      });
    });

    it("derives the host from the environment when omitted", () => {
      const construct = new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        zone,
      });

      expect(construct.host).toBe("intake.example.com");
    });

    it("includes the environment tier in the derived host", () => {
      process.env.PROJECT_ENV = CDK.ENV.SANDBOX;
      const construct = new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        zone,
      });

      expect(construct.host).toBe("intake.sandbox.example.com");
    });

    it("drops the environment tier in production", () => {
      process.env.PROJECT_ENV = CDK.ENV.PRODUCTION;
      const construct = new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        zone,
      });

      expect(construct.host).toBe("intake.example.com");
    });
  });

  describe("Specific Scenarios", () => {
    it("orders the rule after the identity", () => {
      new JaypieSesIntake(stack, "Intake", {
        code: CODE,
        host: HOST,
        zone,
      });
      const template = Template.fromStack(stack);

      const [rule] = Object.values(
        template.findResources("AWS::SES::ReceiptRule"),
      );
      const identityLogicalId = Object.keys(
        template.findResources("AWS::SES::EmailIdentity"),
      )[0];
      expect((rule as any).DependsOn).toContain(identityLogicalId);
    });

    it("does not double-create the identity when reused across scopes", () => {
      new JaypieSesIntake(stack, "IntakeOne", {
        code: CODE,
        host: HOST,
        zone,
      });
      new JaypieSesIntake(stack, "IntakeTwo", {
        activate: false,
        code: CODE,
        host: "other.example.com",
        zone,
      });
      const template = Template.fromStack(stack);

      template.resourceCountIs("AWS::SES::EmailIdentity", 2);
      template.resourceCountIs("AWS::SES::ReceiptRuleSet", 2);
    });
  });
});
