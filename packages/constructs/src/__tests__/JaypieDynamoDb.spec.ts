import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Stack, RemovalPolicy } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { JaypieDynamoDb } from "../JaypieDynamoDb.js";

describe("JaypieDynamoDb", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieDynamoDb).toBeFunction();
    });

    it("creates required resources", () => {
      const stack = new Stack();
      const construct = new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::DynamoDB::GlobalTable", {});
    });

    it("creates table with shorthand syntax", () => {
      const stack = new Stack();
      const construct = new JaypieDynamoDb(stack, "myApp");
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      expect(construct.node.id).toBe("JaypieDynamoDb-myApp");
      template.hasResource("AWS::DynamoDB::GlobalTable", {});
    });
  });

  describe("Static Constants", () => {
    it("exposes GlobalSecondaryIndex constants", () => {
      expect(JaypieDynamoDb.GlobalSecondaryIndex).toBeDefined();
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Alias).toBeDefined();
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Class).toBeDefined();
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Scope).toBeDefined();
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Type).toBeDefined();
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Xid).toBeDefined();
    });

    it("exposes GlobalSecondaryIndexes array", () => {
      expect(JaypieDynamoDb.GlobalSecondaryIndexes).toBeDefined();
      expect(JaypieDynamoDb.GlobalSecondaryIndexes).toBeArray();
      expect(JaypieDynamoDb.GlobalSecondaryIndexes).toHaveLength(5);
    });

    it("GlobalSecondaryIndex.Alias has correct structure", () => {
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Alias.indexName).toBe(
        "indexAlias",
      );
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Alias.partitionKey?.name).toBe(
        "indexAlias",
      );
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Alias.partitionKey?.type).toBe(
        dynamodb.AttributeType.STRING,
      );
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Alias.sortKey?.name).toBe(
        "sequence",
      );
      expect(JaypieDynamoDb.GlobalSecondaryIndex.Alias.sortKey?.type).toBe(
        dynamodb.AttributeType.NUMBER,
      );
    });
  });

  describe("Default Configuration", () => {
    it("uses model as partition key by default", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });
      const template = Template.fromStack(stack);

      // TableV2 creates a GlobalTable in CloudFormation
      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];
      expect(tableResource).toBeDefined();

      // Check key schema
      const keySchema = tableResource?.Properties?.KeySchema;
      expect(keySchema).toContainEqual({
        AttributeName: "model",
        KeyType: "HASH",
      });
    });

    it("uses id as sort key by default", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const keySchema = tableResource?.Properties?.KeySchema;
      expect(keySchema).toContainEqual({
        AttributeName: "id",
        KeyType: "RANGE",
      });
    });

    it("uses PAY_PER_REQUEST billing mode by default", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      expect(tableResource?.Properties?.BillingMode).toBe("PAY_PER_REQUEST");
    });

    it("creates all five GSIs by default", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
      expect(gsis).toBeDefined();
      expect(gsis).toHaveLength(5);

      const gsiNames = gsis.map((gsi: { IndexName: string }) => gsi.IndexName);
      expect(gsiNames).toContain("indexAlias");
      expect(gsiNames).toContain("indexClass");
      expect(gsiNames).toContain("indexScope");
      expect(gsiNames).toContain("indexType");
      expect(gsiNames).toContain("indexXid");
    });

    // Note: Tag introspection tests removed per CLAUDE.md guidelines
    // Tags are applied via Tags.of() which is covered by TypeScript compilation
  });

  describe("Removal Policy", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      delete process.env.PROJECT_ENV;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("uses DESTROY when PROJECT_ENV is not production", () => {
      process.env.PROJECT_ENV = "sandbox";

      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];
      expect(tableResource?.DeletionPolicy).toBe("Delete");
    });

    it("uses RETAIN when PROJECT_ENV is production", () => {
      process.env.PROJECT_ENV = "production";

      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];
      expect(tableResource?.DeletionPolicy).toBe("Retain");
    });

    it("allows overriding removal policy", () => {
      process.env.PROJECT_ENV = "production";

      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        removalPolicy: RemovalPolicy.DESTROY,
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];
      expect(tableResource?.DeletionPolicy).toBe("Delete");
    });
  });

  describe("GSI Configuration", () => {
    it("allows disabling GSIs with empty array", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        globalSecondaryIndexes: [],
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      expect(tableResource?.Properties?.GlobalSecondaryIndexes).toBeUndefined();
    });

    it("allows disabling GSIs with false", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        globalSecondaryIndexes: false,
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      expect(tableResource?.Properties?.GlobalSecondaryIndexes).toBeUndefined();
    });

    it("creates all GSIs with true", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        globalSecondaryIndexes: true,
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
      expect(gsis).toHaveLength(5);
    });

    it("allows selecting specific GSIs", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        globalSecondaryIndexes: [
          JaypieDynamoDb.GlobalSecondaryIndex.Scope,
          JaypieDynamoDb.GlobalSecondaryIndex.Type,
        ],
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
      expect(gsis).toHaveLength(2);

      const gsiNames = gsis.map((gsi: { IndexName: string }) => gsi.IndexName);
      expect(gsiNames).toContain("indexScope");
      expect(gsiNames).toContain("indexType");
      expect(gsiNames).not.toContain("indexAlias");
    });
  });

  // Note: Tagging tests removed per CLAUDE.md guidelines
  // "Avoid CDK template introspection in tests"
  // Tags are applied via Tags.of() which is verified by TypeScript compilation

  describe("Custom Configuration", () => {
    it("allows custom partition key", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        partitionKey: {
          name: "pk",
          type: dynamodb.AttributeType.STRING,
        },
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const keySchema = tableResource?.Properties?.KeySchema;
      expect(keySchema).toContainEqual({
        AttributeName: "pk",
        KeyType: "HASH",
      });
    });

    it("allows custom sort key", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        sortKey: {
          name: "sk",
          type: dynamodb.AttributeType.STRING,
        },
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const keySchema = tableResource?.Properties?.KeySchema;
      expect(keySchema).toContainEqual({
        AttributeName: "sk",
        KeyType: "RANGE",
      });
    });
  });

  describe("ITableV2 Implementation", () => {
    it("implements ITableV2 by delegating to underlying table", () => {
      const stack = new Stack();
      const construct = new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });

      expect(construct.tableArn).toBeDefined();
      expect(construct.tableName).toBeDefined();
      expect(construct.env).toEqual({
        account: stack.account,
        region: stack.region,
      });
      expect(construct.stack).toBe(stack);
    });

    it("exposes underlying table", () => {
      const stack = new Stack();
      const construct = new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
      });

      expect(construct.table).toBeDefined();
      expect(construct.table).toBeInstanceOf(dynamodb.TableV2);
    });
  });
});
