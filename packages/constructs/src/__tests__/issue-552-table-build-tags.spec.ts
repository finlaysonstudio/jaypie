import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import { JaypieDynamoDb } from "../JaypieDynamoDb.js";
import { JaypieInfrastructureStack } from "../JaypieInfrastructureStack.js";

//
//
// Constants
//

const BUILD_TAGS = [
  "buildDate",
  "buildHex",
  "buildTime",
  "commit",
  "stackSha",
  "version",
];
const COMMIT = "aaaaaaaaaaaaaaaa";

//
//
// Helpers
//

function tagKeys(tags: { Key: string }[] = []): string[] {
  return tags.map((tag) => tag.Key);
}

//
//
// Tests
//

describe("Issue #552: CDK owns indexes, so tables take per-build tags", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.npm_package_version;
    process.env.CDK_ENV_INFRASTRUCTURE_STACK_SHA = COMMIT;
    process.env.PROJECT_COMMIT = COMMIT;
    process.env.PROJECT_VERSION = "1.0.0";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("applies build tags to table resources", () => {
    const app = new App();
    const stack = new JaypieInfrastructureStack(app, "TestStack", {
      stackName: "test-stack",
    });
    new JaypieDynamoDb(stack, "myApp");
    new dynamodb.Table(stack, "LegacyTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
    });
    const template = Template.fromStack(stack);

    const globalTable = Object.values(
      template.findResources("AWS::DynamoDB::GlobalTable"),
    )[0];
    const replicaTags = tagKeys(globalTable.Properties.Replicas[0].Tags);
    const table = Object.values(
      template.findResources("AWS::DynamoDB::Table"),
    )[0];
    const tableTags = tagKeys(table.Properties.Tags);

    for (const key of BUILD_TAGS) {
      expect(replicaTags).toContain(key);
      expect(tableTags).toContain(key);
    }
  });
});
