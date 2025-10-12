/* eslint-disable vitest/expect-expect */

import { CDK } from "@jaypie/cdk";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it, beforeEach } from "vitest";
import { JaypieHostedZone } from "../JaypieHostedZone";

describe("JaypieHostedZone", () => {
  let app: App;
  let stack: Stack;
  let template: Template;

  // Base Cases
  describe("Base Cases", () => {
    beforeEach(() => {
      app = new App();
      stack = new Stack(app, "TestStack");
      const zone = new JaypieHostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });
      template = Template.fromStack(stack);
    });

    it("is a Construct", () => {
      expect(JaypieHostedZone).toBeDefined();
    });

    it("creates a hosted zone", () => {
      template.hasResourceProperties("AWS::Route53::HostedZone", {
        Name: "example.com.",
      });
    });

    it("creates a log group", () => {
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/aws/route53/example.com",
        RetentionInDays: 7,
      });
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    it("throws when zoneName is not provided", () => {
      app = new App();
      stack = new Stack(app, "TestStack");
      // @ts-expect-error Testing error case
      expect(() => new JaypieHostedZone(stack, "TestZone", {})).toThrow();
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    beforeEach(() => {
      app = new App();
      stack = new Stack(app, "TestStack");
      const zone = new JaypieHostedZone(stack, "TestZone", {
        zoneName: "example.com",
        service: "test-service",
        project: "test-project",
      });
      template = Template.fromStack(stack);
    });

    it("adds service and role tags to hosted zone", () => {
      template.hasResourceProperties("AWS::Route53::HostedZone", {
        HostedZoneTags: [
          { Key: CDK.TAG.PROJECT, Value: "test-project" },
          { Key: CDK.TAG.ROLE, Value: CDK.ROLE.NETWORKING },
          { Key: CDK.TAG.SERVICE, Value: "test-service" },
        ],
      });
    });

    it("adds service and role tags to log group", () => {
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/aws/route53/example.com",
        RetentionInDays: 7,
        Tags: [
          { Key: CDK.TAG.PROJECT, Value: "test-project" },
          { Key: CDK.TAG.ROLE, Value: CDK.ROLE.NETWORKING },
          { Key: CDK.TAG.SERVICE, Value: "test-service" },
        ],
      });
    });
  });

  // Features
  describe("Features", () => {
    it("appends PROJECT_NONCE to log group name when present", () => {
      process.env.PROJECT_NONCE = "test123";
      app = new App();
      stack = new Stack(app, "TestStack");
      const zone = new JaypieHostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/aws/route53/example.com-test123",
      });
      delete process.env.PROJECT_NONCE;
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("uses default infrastructure service when not provided", () => {
      app = new App();
      stack = new Stack(app, "TestStack");
      const zone = new JaypieHostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::HostedZone", {
        HostedZoneTags: [
          { Key: CDK.TAG.ROLE, Value: CDK.ROLE.NETWORKING },
          { Key: CDK.TAG.SERVICE, Value: CDK.SERVICE.INFRASTRUCTURE },
        ],
      });
    });

    it("creates DNS records when provided", () => {
      app = new App();
      stack = new Stack(app, "TestStack");
      const zone = new JaypieHostedZone(stack, "TestZone", {
        zoneName: "example.com",
        records: [
          {
            type: CDK.DNS.RECORD.A,
            recordName: "www",
            values: ["1.2.3.4"],
          },
          {
            type: CDK.DNS.RECORD.CNAME,
            recordName: "api",
            values: ["example.com"],
          },
        ],
      });
      template = Template.fromStack(stack);

      // Verify hosted zone exists
      template.hasResourceProperties("AWS::Route53::HostedZone", {
        Name: "example.com.",
      });

      // Verify A record
      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "www.example.com.",
        ResourceRecords: ["1.2.3.4"],
        Type: "A",
      });

      // Verify CNAME record
      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "api.example.com.",
        ResourceRecords: ["example.com"],
        Type: "CNAME",
      });

      // Verify dnsRecords property
      expect(zone.dnsRecords).toHaveLength(2);
      expect(zone.dnsRecords[0]).toBeDefined();
      expect(zone.dnsRecords[1]).toBeDefined();
    });

    it("creates DNS records with custom IDs when provided", () => {
      app = new App();
      stack = new Stack(app, "TestStack");
      const zone = new JaypieHostedZone(stack, "TestZone", {
        zoneName: "example.com",
        records: [
          {
            id: "CustomWebRecord",
            type: CDK.DNS.RECORD.A,
            recordName: "www",
            values: ["1.2.3.4"],
          },
        ],
      });
      template = Template.fromStack(stack);

      // Verify record exists
      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "www.example.com.",
        Type: "A",
      });

      // Verify dnsRecords property
      expect(zone.dnsRecords).toHaveLength(1);
    });

    it("creates hosted zone without records when records array is empty", () => {
      app = new App();
      stack = new Stack(app, "TestStack");
      const zone = new JaypieHostedZone(stack, "TestZone", {
        zoneName: "example.com",
        records: [],
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::HostedZone", {
        Name: "example.com.",
      });

      expect(zone.dnsRecords).toHaveLength(0);
    });

    it("creates hosted zone without records when records prop is not provided", () => {
      app = new App();
      stack = new Stack(app, "TestStack");
      const zone = new JaypieHostedZone(stack, "TestZone", {
        zoneName: "example.com",
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Route53::HostedZone", {
        Name: "example.com.",
      });

      expect(zone.dnsRecords).toHaveLength(0);
    });
  });
});
