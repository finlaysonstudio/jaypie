import { describe, expect, it } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { Duration, Stack } from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";

import { JaypieDynamoDb } from "../JaypieDynamoDb.js";
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
      expect(template).toBeDefined();
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
      expect(template).toBeDefined();
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
      expect(template).toBeDefined();
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

    it("grants describe-only control-plane DynamoDB perms to passed tables (issues #339, #552)", () => {
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
      const policies = template.findResources("AWS::IAM::Policy");
      const allActions = new Set<string>();
      for (const policy of Object.values(policies)) {
        const statements = (policy as any).Properties?.PolicyDocument
          ?.Statement as Array<{ Action: unknown }>;
        for (const statement of statements ?? []) {
          const actions = Array.isArray(statement.Action)
            ? statement.Action
            : [statement.Action];
          for (const action of actions) {
            if (typeof action === "string") allActions.add(action);
          }
        }
      }
      expect(allActions.has("dynamodb:DescribeContinuousBackups")).toBe(true);
      expect(allActions.has("dynamodb:DescribeTable")).toBe(true);
      expect(allActions.has("dynamodb:DescribeTimeToLive")).toBe(true);
      expect(allActions.has("dynamodb:UpdateContinuousBackups")).toBe(false);
      expect(allActions.has("dynamodb:UpdateTable")).toBe(false);
      expect(allActions.has("dynamodb:UpdateTimeToLive")).toBe(false);
    });

    it("warns when a JaypieDynamoDb table declares no indexes (issue #552)", () => {
      const stack = new Stack();
      const table = new JaypieDynamoDb(stack, "TestTable");

      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        tables: [table],
      });

      const warnings = Annotations.fromStack(stack).findWarning(
        "*",
        Match.stringLikeRegexp("declares no indexes"),
      );
      expect(warnings).toHaveLength(1);
    });

    it("does not warn when a JaypieDynamoDb table declares indexes (issue #552)", () => {
      const stack = new Stack();
      const table = new JaypieDynamoDb(stack, "TestTable", {
        indexes: [
          { name: "indexModel", pk: ["model"], sk: ["scope", "updatedAt"] },
        ],
      });

      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        tables: [table],
      });

      const warnings = Annotations.fromStack(stack).findWarning(
        "*",
        Match.stringLikeRegexp("declares no indexes"),
      );
      expect(warnings).toHaveLength(0);
    });

    it("grants Query and Scan on indexes of tables that declare none (issue #546)", () => {
      const stack = new Stack();
      const table = new JaypieDynamoDb(stack, "TestTable");

      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        tables: [table],
      });

      const template = Template.fromStack(stack);
      const policies = template.findResources("AWS::IAM::Policy");
      const indexActions = new Set<string>();
      for (const policy of Object.values(policies)) {
        const statements = (policy as any).Properties?.PolicyDocument
          ?.Statement as Array<{ Action: unknown; Resource: unknown }>;
        for (const statement of statements ?? []) {
          if (!JSON.stringify(statement.Resource).includes("/index/*")) {
            continue;
          }
          const actions = Array.isArray(statement.Action)
            ? statement.Action
            : [statement.Action];
          for (const action of actions) {
            if (typeof action === "string") indexActions.add(action);
          }
        }
      }
      expect(indexActions.has("dynamodb:Query")).toBe(true);
      expect(indexActions.has("dynamodb:Scan")).toBe(true);
    });

    it("defaults Lambda timeout to 15 minutes (issue #341)", () => {
      const stack = new Stack();
      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaFunctions = Object.values(resources);
      const migrationLambda = lambdaFunctions.find(
        (r: any) => r.Properties?.Handler === "index.handler",
      );

      expect(migrationLambda?.Properties?.Timeout).toBe(900);
    });

    it("provisions Step Functions state machine for waiter pattern (issue #346)", () => {
      const stack = new Stack();
      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);
      template.hasResource("AWS::StepFunctions::StateMachine", {});
      expect(template).toBeDefined();
    });

    it("accepts queryInterval prop (issue #346)", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieMigration(stack, "TestMigration", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          queryInterval: Duration.seconds(30),
        });
      }).not.toThrow();
    });

    it("accepts totalTimeout prop (issue #346)", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieMigration(stack, "TestMigration", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          totalTimeout: Duration.hours(4),
        });
      }).not.toThrow();
    });

    it("accepts a custom timeout (issue #341)", () => {
      const stack = new Stack();
      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        timeout: Duration.minutes(7),
      });

      const template = Template.fromStack(stack);
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaFunctions = Object.values(resources);
      const migrationLambda = lambdaFunctions.find(
        (r: any) => r.Properties?.Handler === "index.handler",
      );

      expect(migrationLambda?.Properties?.Timeout).toBe(420);
    });

    it("does not grant DynamoDB perms with star resource (issue #339)", () => {
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
      const policies = template.findResources("AWS::IAM::Policy");
      for (const policy of Object.values(policies)) {
        const statements = (policy as any).Properties?.PolicyDocument
          ?.Statement as Array<{ Action: unknown; Resource: unknown }>;
        for (const statement of statements ?? []) {
          const actions = Array.isArray(statement.Action)
            ? statement.Action
            : [statement.Action];
          const usesDynamoControlPlane = actions.some(
            (action) =>
              typeof action === "string" &&
              action.startsWith("dynamodb:Describe"),
          );
          if (usesDynamoControlPlane) {
            expect(statement.Resource).not.toBe("*");
          }
        }
      }
    });
  });

  describe("Log Group (issue #565)", () => {
    it("forwards a provided logGroup to the wrapped Lambda", () => {
      const stack = new Stack();
      const logGroup = new logs.LogGroup(stack, "MigrationLogGroup", {
        retention: logs.RetentionDays.ONE_YEAR,
      });

      const migration = new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        logGroup,
      });

      // JaypieLambda only creates its own "LogGroup" child when none is provided
      expect(migration.lambda.node.tryFindChild("LogGroup")).toBeUndefined();

      const template = Template.fromStack(stack);
      const logGroupId = stack.resolve(logGroup.logGroupName);
      const migrationLambda = Object.values(
        template.findResources("AWS::Lambda::Function"),
      ).find(
        (resource: any) => resource.Properties?.Handler === "index.handler",
      );

      expect(migrationLambda?.Properties?.LoggingConfig?.LogGroup).toEqual(
        logGroupId,
      );
    });

    it("forwards logRetention to the Lambda log group", () => {
      const stack = new Stack();
      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        logRetention: logs.RetentionDays.ONE_YEAR,
      });

      const template = Template.fromStack(stack);
      const retentions = Object.values(
        template.findResources("AWS::Logs::LogGroup"),
      ).map((resource: any) => resource.Properties?.RetentionInDays);

      expect(retentions).toContain(365);
    });

    it("forwards reservedConcurrentExecutions to the wrapped Lambda", () => {
      const stack = new Stack();
      new JaypieMigration(stack, "TestMigration", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        reservedConcurrentExecutions: 2,
      });

      const template = Template.fromStack(stack);
      const migrationLambda = Object.values(
        template.findResources("AWS::Lambda::Function"),
      ).find(
        (resource: any) => resource.Properties?.Handler === "index.handler",
      );

      expect(migrationLambda?.Properties?.ReservedConcurrentExecutions).toBe(2);
    });

    it("rejects reservedConcurrentExecutions of 0", () => {
      const stack = new Stack();
      expect(
        () =>
          new JaypieMigration(stack, "TestMigration", {
            code: lambda.Code.fromInline("exports.handler = () => {}"),
            handler: "index.handler",
            reservedConcurrentExecutions: 0,
          }),
      ).toThrow(ConfigurationError);
    });
  });
});
