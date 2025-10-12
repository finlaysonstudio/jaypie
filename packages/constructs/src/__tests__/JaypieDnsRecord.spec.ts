/* eslint-disable vitest/expect-expect */

import { CDK } from "@jaypie/cdk";
import { App, Duration, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { beforeEach, describe, expect, it } from "vitest";

import { JaypieDnsRecord } from "../JaypieDnsRecord";

describe("JaypieDnsRecord", () => {
  let app: App;
  let stack: Stack;
  let template: Template;
  let zone: HostedZone;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, "TestStack");
    zone = new HostedZone(stack, "Zone", {
      zoneName: "example.com",
    });
  });

  // Note: zone prop can also accept a string (zone name) which will be looked up via HostedZone.fromLookup
  // This requires AWS context and cannot be tested in unit tests

  // Base Cases
  describe("Base Cases", () => {
    it("is a Construct", () => {
      expect(JaypieDnsRecord).toBeDefined();
    });

    it("creates an A record", () => {
      new JaypieDnsRecord(stack, "ARecord", {
        type: CDK.DNS.RECORD.A,
        values: ["1.2.3.4"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        ResourceRecords: ["1.2.3.4"],
        Type: "A",
      });
    });

    it("creates a CNAME record", () => {
      new JaypieDnsRecord(stack, "CnameRecord", {
        recordName: "www",
        type: CDK.DNS.RECORD.CNAME,
        values: ["example.com"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "www.example.com.",
        ResourceRecords: ["example.com"],
        Type: "CNAME",
      });
    });

    it("creates an MX record", () => {
      new JaypieDnsRecord(stack, "MxRecord", {
        type: CDK.DNS.RECORD.MX,
        values: [
          { hostName: "mail1.example.com", priority: 10 },
          { hostName: "mail2.example.com", priority: 20 },
        ],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        ResourceRecords: ["10 mail1.example.com", "20 mail2.example.com"],
        Type: "MX",
      });
    });

    it("creates an NS record", () => {
      new JaypieDnsRecord(stack, "NsRecord", {
        recordName: "subdomain",
        type: CDK.DNS.RECORD.NS,
        values: ["ns1.example.com", "ns2.example.com"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "subdomain.example.com.",
        ResourceRecords: ["ns1.example.com", "ns2.example.com"],
        Type: "NS",
      });
    });

    it("creates a TXT record", () => {
      new JaypieDnsRecord(stack, "TxtRecord", {
        recordName: "_dmarc",
        type: CDK.DNS.RECORD.TXT,
        values: ["v=DMARC1; p=none"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "_dmarc.example.com.",
        ResourceRecords: ['"v=DMARC1; p=none"'],
        Type: "TXT",
      });
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    it("throws for unsupported record type", () => {
      expect(
        () =>
          new JaypieDnsRecord(stack, "InvalidRecord", {
            type: "INVALID",
            values: ["test"],
            zone,
          }),
      ).toThrow();
    });

    it("throws when A record has no values", () => {
      expect(
        () =>
          new JaypieDnsRecord(stack, "ARecord", {
            type: CDK.DNS.RECORD.A,
            values: [],
            zone,
          }),
      ).toThrow();
    });

    it("throws when CNAME record has no values", () => {
      expect(
        () =>
          new JaypieDnsRecord(stack, "CnameRecord", {
            type: CDK.DNS.RECORD.CNAME,
            values: [],
            zone,
          }),
      ).toThrow();
    });

    it("throws when MX record has no values", () => {
      expect(
        () =>
          new JaypieDnsRecord(stack, "MxRecord", {
            type: CDK.DNS.RECORD.MX,
            values: [],
            zone,
          }),
      ).toThrow();
    });

    it("throws when NS record has no values", () => {
      expect(
        () =>
          new JaypieDnsRecord(stack, "NsRecord", {
            type: CDK.DNS.RECORD.NS,
            values: [],
            zone,
          }),
      ).toThrow();
    });

    it("throws when TXT record has no values", () => {
      expect(
        () =>
          new JaypieDnsRecord(stack, "TxtRecord", {
            type: CDK.DNS.RECORD.TXT,
            values: [],
            zone,
          }),
      ).toThrow();
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("creates A record with multiple IP addresses", () => {
      new JaypieDnsRecord(stack, "ARecord", {
        type: CDK.DNS.RECORD.A,
        values: ["1.2.3.4", "5.6.7.8"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        ResourceRecords: ["1.2.3.4", "5.6.7.8"],
        Type: "A",
      });
    });

    it("creates TXT record with multiple values", () => {
      new JaypieDnsRecord(stack, "TxtRecord", {
        type: CDK.DNS.RECORD.TXT,
        values: [
          "v=spf1 include:example.com ~all",
          "google-site-verification=abc123",
        ],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        ResourceRecords: [
          '"v=spf1 include:example.com ~all"',
          '"google-site-verification=abc123"',
        ],
        Type: "TXT",
      });
    });

    it("uses custom TTL when provided", () => {
      new JaypieDnsRecord(stack, "ARecord", {
        ttl: Duration.minutes(10),
        type: CDK.DNS.RECORD.A,
        values: ["1.2.3.4"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        TTL: "600",
        Type: "A",
      });
    });

    it("adds comment when provided", () => {
      new JaypieDnsRecord(stack, "ARecord", {
        comment: "Production web server",
        type: CDK.DNS.RECORD.A,
        values: ["1.2.3.4"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Comment: "Production web server",
        Type: "A",
      });
    });
  });

  // Features
  describe("Features", () => {
    it("accepts IHostedZone object for zone", () => {
      new JaypieDnsRecord(stack, "ARecord", {
        type: CDK.DNS.RECORD.A,
        values: ["1.2.3.4"],
        zone, // IHostedZone object
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Type: "A",
      });
    });

    it("uses default TTL of 5 minutes when not provided", () => {
      new JaypieDnsRecord(stack, "ARecord", {
        type: CDK.DNS.RECORD.A,
        values: ["1.2.3.4"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        TTL: "300", // 5 minutes in seconds
        Type: "A",
      });
    });

    it("creates record at zone apex when recordName is not provided", () => {
      new JaypieDnsRecord(stack, "ARecord", {
        type: CDK.DNS.RECORD.A,
        values: ["1.2.3.4"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "example.com.",
        Type: "A",
      });
    });

    it("creates record with subdomain when recordName is provided", () => {
      new JaypieDnsRecord(stack, "ARecord", {
        recordName: "api",
        type: CDK.DNS.RECORD.A,
        values: ["1.2.3.4"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "api.example.com.",
        Type: "A",
      });
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("creates SPF record using TXT type", () => {
      new JaypieDnsRecord(stack, "SpfRecord", {
        type: CDK.DNS.RECORD.TXT,
        values: ["v=spf1 include:_spf.example.com ~all"],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        ResourceRecords: ['"v=spf1 include:_spf.example.com ~all"'],
        Type: "TXT",
      });
    });

    it("creates DKIM record using TXT type with recordName", () => {
      new JaypieDnsRecord(stack, "DkimRecord", {
        recordName: "default._domainkey",
        type: CDK.DNS.RECORD.TXT,
        values: ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ..."],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "default._domainkey.example.com.",
        Type: "TXT",
      });
    });

    it("creates subdomain delegation using NS record", () => {
      new JaypieDnsRecord(stack, "SubdomainNs", {
        recordName: "subdomain",
        type: CDK.DNS.RECORD.NS,
        values: [
          "ns-1.awsdns.com",
          "ns-2.awsdns.org",
          "ns-3.awsdns.net",
          "ns-4.awsdns.co.uk",
        ],
        zone,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "subdomain.example.com.",
        ResourceRecords: [
          "ns-1.awsdns.com",
          "ns-2.awsdns.org",
          "ns-3.awsdns.net",
          "ns-4.awsdns.co.uk",
        ],
        Type: "NS",
      });
    });
  });
});
