import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Stack, RemovalPolicy } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { JaypieDynamoDb } from "../JaypieDynamoDb.js";
import type { IndexDefinition } from "../types/IndexDefinition.js";

const indexModel = (field?: string): IndexDefinition =>
  field
    ? {
        name: `indexModel${field.charAt(0).toUpperCase()}${field.slice(1)}`,
        pk: ["model", field],
        sk: ["scope", "updatedAt"],
        sparse: true,
      }
    : { name: "indexModel", pk: ["model"], sk: ["scope", "updatedAt"] };

const STANDARD_INDEXES: IndexDefinition[] = [
  indexModel(),
  indexModel("alias"),
  indexModel("category"),
  indexModel("type"),
  indexModel("xid"),
];

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

  describe("Default Configuration", () => {
    it("uses id as partition key by default", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", { tableName: "test-table" });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];
      expect(tableResource).toBeDefined();

      const keySchema = tableResource?.Properties?.KeySchema;
      expect(keySchema).toContainEqual({
        AttributeName: "id",
        KeyType: "HASH",
      });
    });

    it("has no sort key by default", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", { tableName: "test-table" });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const keySchema = tableResource?.Properties?.KeySchema;
      const rangeKey = keySchema?.find(
        (k: { KeyType: string }) => k.KeyType === "RANGE",
      );
      expect(rangeKey).toBeUndefined();
    });

    it("uses PAY_PER_REQUEST billing mode by default", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", { tableName: "test-table" });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      expect(tableResource?.Properties?.BillingMode).toBe("PAY_PER_REQUEST");
    });

    it("creates no GSIs by default", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", { tableName: "test-table" });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      expect(tableResource?.Properties?.GlobalSecondaryIndexes).toBeUndefined();
    });
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
      new JaypieDynamoDb(stack, "TestTable", { tableName: "test-table" });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];
      expect(tableResource?.DeletionPolicy).toBe("Delete");
    });

    it("uses RETAIN when PROJECT_ENV is production", () => {
      process.env.PROJECT_ENV = "production";

      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", { tableName: "test-table" });
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
    it("creates fabricIndex GSIs with model-keyed partition keys", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        indexes: STANDARD_INDEXES,
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
      expect(gsis).toBeDefined();
      expect(gsis).toHaveLength(5);

      const gsiNames = gsis.map((gsi: { IndexName: string }) => gsi.IndexName);
      expect(gsiNames).toContain("indexModel");
      expect(gsiNames).toContain("indexModelAlias");
      expect(gsiNames).toContain("indexModelCategory");
      expect(gsiNames).toContain("indexModelType");
      expect(gsiNames).toContain("indexModelXid");
    });

    it("uses composite sk attribute {indexName}Sk for fabricIndex", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        indexes: [indexModel(), indexModel("alias")],
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
      const indexModelGsi = gsis.find(
        (g: { IndexName: string }) => g.IndexName === "indexModel",
      );
      const keySchema = indexModelGsi?.KeySchema;
      expect(keySchema).toContainEqual({
        AttributeName: "indexModel",
        KeyType: "HASH",
      });
      expect(keySchema).toContainEqual({
        AttributeName: "indexModelSk",
        KeyType: "RANGE",
      });
    });

    it("declares composite sk attributes as STRING", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        indexes: [indexModel()],
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const attrs = tableResource?.Properties?.AttributeDefinitions;
      expect(attrs).toContainEqual({
        AttributeName: "indexModelSk",
        AttributeType: "S",
      });
    });

    it("allows disabling GSIs with empty array", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        indexes: [],
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      expect(tableResource?.Properties?.GlobalSecondaryIndexes).toBeUndefined();
    });

    it("allows selecting specific fabricIndex shapes", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        indexes: [indexModel(), indexModel("type")],
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
      expect(gsis).toHaveLength(2);

      const gsiNames = gsis.map((gsi: { IndexName: string }) => gsi.IndexName);
      expect(gsiNames).toContain("indexModel");
      expect(gsiNames).toContain("indexModelType");
      expect(gsiNames).not.toContain("indexModelAlias");
    });

    it("accepts arbitrary field names via fabricIndex", () => {
      const stack = new Stack();
      new JaypieDynamoDb(stack, "TestTable", {
        tableName: "test-table",
        indexes: [indexModel("taco")],
      });
      const template = Template.fromStack(stack);

      const tables = template.findResources("AWS::DynamoDB::GlobalTable");
      const tableResource = Object.values(tables)[0];

      const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
      const gsiNames = gsis.map((gsi: { IndexName: string }) => gsi.IndexName);
      expect(gsiNames).toContain("indexModelTaco");
    });
  });

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

    it("allows an opt-in sort key", () => {
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
