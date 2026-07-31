/* eslint-disable vitest/expect-expect */
// Template.hasResourceProperties and resourceCountIs assert; the rule cannot see it

import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { describe, expect, it } from "vitest";

import { CDK } from "../constants";
import { JaypieBucketQueuedLambda } from "../JaypieBucketQueuedLambda.js";
import { JaypieQueuedLambda } from "../JaypieQueuedLambda.js";

const CODE = lambda.Code.fromInline("exports.handler = () => {}");

function sourceQueue(template: Template) {
  const queues = Object.values(template.findResources("AWS::SQS::Queue"));
  const source = queues.find((queue: any) => queue.Properties?.RedrivePolicy);
  return source as any;
}

describe("issue 455: JaypieQueuedLambda dead-letter queue", () => {
  describe("Base Cases", () => {
    it("creates no dead-letter queue by default", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct.dlq).toBeUndefined();
      template.resourceCountIs("AWS::SQS::Queue", 1);
      const queues = Object.values(template.findResources("AWS::SQS::Queue"));
      expect((queues[0] as any).Properties.RedrivePolicy).toBeUndefined();
    });
  });

  describe("Features", () => {
    it("creates a dead-letter queue and redrive policy when dlq is true", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: true,
      });
      const template = Template.fromStack(stack);

      expect(construct.dlq).toBeDefined();
      template.resourceCountIs("AWS::SQS::Queue", 2);
      expect(sourceQueue(template).Properties.RedrivePolicy).toMatchObject({
        maxReceiveCount: CDK.SQS.DLQ.MAX_RECEIVE_COUNT,
      });
    });

    it("retains dead-letter messages for the SQS maximum by default", () => {
      const stack = new Stack();
      new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: true,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SQS::Queue", {
        MessageRetentionPeriod: Duration.days(
          CDK.SQS.DLQ.RETENTION_DAYS,
        ).toSeconds(),
      });
    });

    it("treats a number as maxReceiveCount", () => {
      const stack = new Stack();
      new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: 5,
      });
      const template = Template.fromStack(stack);

      expect(sourceQueue(template).Properties.RedrivePolicy).toMatchObject({
        maxReceiveCount: 5,
      });
    });

    it("accepts explicit maxReceiveCount and retentionPeriod", () => {
      const stack = new Stack();
      new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: { maxReceiveCount: 4, retentionPeriod: Duration.days(7) },
      });
      const template = Template.fromStack(stack);

      expect(sourceQueue(template).Properties.RedrivePolicy).toMatchObject({
        maxReceiveCount: 4,
      });
      template.hasResourceProperties("AWS::SQS::Queue", {
        MessageRetentionPeriod: Duration.days(7).toSeconds(),
      });
    });

    it("accepts retentionPeriod as seconds", () => {
      const stack = new Stack();
      new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: { retentionPeriod: 3600 },
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SQS::Queue", {
        MessageRetentionPeriod: 3600,
      });
    });

    it("matches the source queue fifo setting", () => {
      const fifoStack = new Stack();
      new JaypieQueuedLambda(fifoStack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: true,
      });
      const fifoQueues = Object.values(
        Template.fromStack(fifoStack).findResources("AWS::SQS::Queue"),
      );
      expect(fifoQueues).toHaveLength(2);
      fifoQueues.forEach((queue: any) => {
        expect(queue.Properties.FifoQueue).toBe(true);
      });

      const standardStack = new Stack();
      new JaypieQueuedLambda(standardStack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: true,
        fifo: false,
      });
      const standardQueues = Object.values(
        Template.fromStack(standardStack).findResources("AWS::SQS::Queue"),
      );
      expect(standardQueues).toHaveLength(2);
      standardQueues.forEach((queue: any) => {
        expect(queue.Properties.FifoQueue).toBeUndefined();
      });
    });

    it("uses an existing queue when provided", () => {
      const stack = new Stack();
      const existing = new sqs.Queue(stack, "ExistingDlq", { fifo: true });
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: { queue: existing },
      });
      const template = Template.fromStack(stack);

      expect(construct.dlq).toBe(existing);
      // Source queue plus the pre-existing queue; none created by the construct
      template.resourceCountIs("AWS::SQS::Queue", 2);
      expect(
        sourceQueue(template).Properties.RedrivePolicy.deadLetterTargetArn[
          "Fn::GetAtt"
        ][0],
      ).toMatch(/^ExistingDlq/);
    });

    it("tags the dead-letter queue like the source queue", () => {
      const stack = new Stack();
      new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: true,
        roleTag: "TEST_ROLE",
        serviceTag: "TEST_SERVICE",
        vendorTag: "TEST_VENDOR",
      });
      const template = Template.fromStack(stack);

      const queues = Object.values(template.findResources("AWS::SQS::Queue"));
      expect(queues).toHaveLength(2);
      queues.forEach((queue: any) => {
        expect(queue.Properties.Tags).toEqual(
          expect.arrayContaining([
            { Key: CDK.TAG.ROLE, Value: "TEST_ROLE" },
            { Key: CDK.TAG.SERVICE, Value: "TEST_SERVICE" },
            { Key: CDK.TAG.VENDOR, Value: "TEST_VENDOR" },
          ]),
        );
      });
    });

    it("applies the removal policy to the dead-letter queue it owns", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: true,
      });

      construct.applyRemovalPolicy(RemovalPolicy.DESTROY);
      const template = Template.fromStack(stack);

      const queues = Object.values(template.findResources("AWS::SQS::Queue"));
      expect(queues).toHaveLength(2);
      queues.forEach((queue: any) => {
        expect(queue.DeletionPolicy).toBe("Delete");
      });
    });

    it("does not preserve the default visibility timeout regression", () => {
      const stack = new Stack();
      new JaypieQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        visibilityTimeout: 120,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SQS::Queue", {
        VisibilityTimeout: 120,
      });
    });
  });

  describe("Specific Scenarios", () => {
    it("applies to JaypieBucketQueuedLambda by inheritance", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: CODE,
        handler: "index.handler",
        dlq: 3,
      });
      const template = Template.fromStack(stack);

      expect(construct.dlq).toBeDefined();
      expect(construct.dlq!.fifo).toBe(false);
      template.resourceCountIs("AWS::SQS::Queue", 2);
      expect(sourceQueue(template).Properties.RedrivePolicy).toMatchObject({
        maxReceiveCount: 3,
      });
    });
  });
});
