import { describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
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

      expect(migrationLambda?.Properties?.Environment?.Variables).toHaveProperty(
        "DYNAMODB_TABLE_NAME",
      );
    });
  });
});
