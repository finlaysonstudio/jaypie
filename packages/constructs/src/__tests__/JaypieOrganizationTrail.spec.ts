import { describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { JaypieOrganizationTrail } from "../JaypieOrganizationTrail.js";

describe("JaypieOrganizationTrail", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieOrganizationTrail).toBeFunction();
    });

    it("creates a trail and bucket", () => {
      const stack = new Stack();
      const construct = new JaypieOrganizationTrail(stack, "TestTrail", {
        enableDatadogNotifications: false,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::CloudTrail::Trail", {});
      template.hasResource("AWS::S3::Bucket", {});
    });
  });

  describe("enableFileValidation", () => {
    it("defaults to true", () => {
      const stack = new Stack();
      new JaypieOrganizationTrail(stack, "TestTrail", {
        enableDatadogNotifications: false,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudTrail::Trail", {
        EnableLogFileValidation: true,
      });
    });

    it("can be set to false", () => {
      const stack = new Stack();
      new JaypieOrganizationTrail(stack, "TestTrail", {
        enableDatadogNotifications: false,
        enableFileValidation: false,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CloudTrail::Trail", {
        EnableLogFileValidation: false,
      });
    });
  });

  describe("enableLambdaDataEvents", () => {
    it("defaults to true (Lambda data events enabled)", () => {
      const stack = new Stack();
      new JaypieOrganizationTrail(stack, "TestTrail", {
        enableDatadogNotifications: false,
      });
      const template = Template.fromStack(stack);

      const resources = template.findResources("AWS::CloudTrail::Trail");
      const trail = Object.values(resources)[0];
      const eventSelectors = trail?.Properties?.EventSelectors || [];
      const hasLambdaSelector = eventSelectors.some((selector: any) =>
        selector.DataResources?.some(
          (dr: any) => dr.Type === "AWS::Lambda::Function",
        ),
      );
      expect(hasLambdaSelector).toBe(true);
    });

    it("can be disabled", () => {
      const stack = new Stack();
      new JaypieOrganizationTrail(stack, "TestTrail", {
        enableDatadogNotifications: false,
        enableLambdaDataEvents: false,
      });
      const template = Template.fromStack(stack);

      // Should not have Lambda event selectors
      const resources = template.findResources("AWS::CloudTrail::Trail");
      const trail = Object.values(resources)[0];
      const eventSelectors = trail?.Properties?.EventSelectors || [];
      const hasLambdaSelector = eventSelectors.some((selector: any) =>
        selector.DataResources?.some(
          (dr: any) => dr.Type === "AWS::Lambda::Function",
        ),
      );
      expect(hasLambdaSelector).toBe(false);
    });
  });

  describe("enableS3DataEvents", () => {
    it("defaults to false (S3 data events disabled)", () => {
      const stack = new Stack();
      new JaypieOrganizationTrail(stack, "TestTrail", {
        enableDatadogNotifications: false,
      });
      const template = Template.fromStack(stack);

      const resources = template.findResources("AWS::CloudTrail::Trail");
      const trail = Object.values(resources)[0];
      const eventSelectors = trail?.Properties?.EventSelectors || [];
      const hasS3Selector = eventSelectors.some((selector: any) =>
        selector.DataResources?.some(
          (dr: any) => dr.Type === "AWS::S3::Object",
        ),
      );
      expect(hasS3Selector).toBe(false);
    });

    it("can be enabled", () => {
      const stack = new Stack();
      new JaypieOrganizationTrail(stack, "TestTrail", {
        enableDatadogNotifications: false,
        enableS3DataEvents: true,
      });
      const template = Template.fromStack(stack);

      const resources = template.findResources("AWS::CloudTrail::Trail");
      const trail = Object.values(resources)[0];
      const eventSelectors = trail?.Properties?.EventSelectors || [];
      const hasS3Selector = eventSelectors.some((selector: any) =>
        selector.DataResources?.some(
          (dr: any) => dr.Type === "AWS::S3::Object",
        ),
      );
      expect(hasS3Selector).toBe(true);
    });
  });
});
