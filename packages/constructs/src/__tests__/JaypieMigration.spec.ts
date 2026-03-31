import { describe, expect, it, vi } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";

import { JaypieMigration } from "../JaypieMigration.js";

describe("JaypieMigration", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieMigration).toBeFunction();
    });

    it("creates required resources", () => {
      const stack = new Stack();
      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      // Should create a Lambda function
      template.hasResource("AWS::Lambda::Function", {});
      // Should create a Custom Resource
      template.hasResource("AWS::CloudFormation::CustomResource", {});
    });
  });

  describe("Features", () => {
    it("grants table read/write access to the migration Lambda", () => {
      const stack = new Stack();
      const table = new dynamodb.Table(stack, "TestTable", {
        partitionKey: { name: "model", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
      });

      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        tables: [table],
      });

      const template = Template.fromStack(stack);

      // Verify IAM policy exists granting DynamoDB access
      template.hasResource("AWS::IAM::Policy", {});
    });

    it("passes environment variables to the migration Lambda", () => {
      const stack = new Stack();
      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        environment: { PROJECT_COMMIT: "abc123" },
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaFunctions = Object.values(resources);
      const migrationLambda = lambdaFunctions.find(
        (r: any) => r.Properties?.Handler === "index.handler",
      );

      expect(
        migrationLambda?.Properties?.Environment?.Variables,
      ).toHaveProperty("PROJECT_COMMIT", "abc123");
    });

    it("includes a deploy nonce in custom resource properties to force re-invocation (issue #261)", () => {
      const stack = new Stack();
      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
        deployNonce: Match.anyValue(),
      });
    });

    it("sets DYNAMODB_TABLE_NAME when one table is provided", () => {
      const stack = new Stack();
      const table = new dynamodb.Table(stack, "TestTable", {
        partitionKey: { name: "model", type: dynamodb.AttributeType.STRING },
      });

      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        tables: [table],
      });

      const template = Template.fromStack(stack);
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaFunctions = Object.values(resources);
      const migrationLambda = lambdaFunctions.find(
        (r: any) => r.Properties?.Handler === "index.handler",
      );

      expect(
        migrationLambda?.Properties?.Environment?.Variables,
      ).toHaveProperty("DYNAMODB_TABLE_NAME");
    });
  });
});
