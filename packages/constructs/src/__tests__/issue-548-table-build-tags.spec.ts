import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";

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
const FIRST_BUILD = new Date("2026-09-01T00:00:00.000Z");
const SECOND_BUILD = new Date("2026-09-13T12:34:56.789Z");

//
//
// Helpers
//

function synth({
  commit,
  date,
  version,
}: {
  commit: string;
  date: Date;
  version: string;
}) {
  vi.setSystemTime(date);
  process.env.PROJECT_COMMIT = commit;
  process.env.CDK_ENV_INFRASTRUCTURE_STACK_SHA = commit;
  process.env.PROJECT_VERSION = version;
  const app = new App();
  const stack = new JaypieInfrastructureStack(app, "TestStack", {
    stackName: "test-stack",
  });
  new JaypieDynamoDb(stack, "myApp");
  new dynamodb.Table(stack, "LegacyTable", {
    partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
  });
  new s3.Bucket(stack, "Bucket");
  return Template.fromStack(stack);
}

function tagKeys(tags: { Key: string }[] = []): string[] {
  return tags.map((tag) => tag.Key);
}

//
//
// Tests
//

describe("Issue #548: build tags force a table update", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    delete process.env.npm_package_version;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it("synthesizes an identical GlobalTable across builds", () => {
    const first = synth({
      commit: "aaaaaaaaaaaaaaaa",
      date: FIRST_BUILD,
      version: "1.0.0",
    });
    const second = synth({
      commit: "bbbbbbbbbbbbbbbb",
      date: SECOND_BUILD,
      version: "1.0.1",
    });

    expect(second.findResources("AWS::DynamoDB::GlobalTable")).toEqual(
      first.findResources("AWS::DynamoDB::GlobalTable"),
    );
  });

  it("synthesizes an identical Table across builds", () => {
    const first = synth({
      commit: "aaaaaaaaaaaaaaaa",
      date: FIRST_BUILD,
      version: "1.0.0",
    });
    const second = synth({
      commit: "bbbbbbbbbbbbbbbb",
      date: SECOND_BUILD,
      version: "1.0.1",
    });

    expect(second.findResources("AWS::DynamoDB::Table")).toEqual(
      first.findResources("AWS::DynamoDB::Table"),
    );
  });

  it("omits build tags from table resources", () => {
    const template = synth({
      commit: "aaaaaaaaaaaaaaaa",
      date: FIRST_BUILD,
      version: "1.0.0",
    });

    const globalTable = Object.values(
      template.findResources("AWS::DynamoDB::GlobalTable"),
    )[0];
    const replicaTags = tagKeys(globalTable.Properties.Replicas[0].Tags);
    const table = Object.values(
      template.findResources("AWS::DynamoDB::Table"),
    )[0];
    const tableTags = tagKeys(table.Properties.Tags);

    for (const key of BUILD_TAGS) {
      expect(replicaTags).not.toContain(key);
      expect(tableTags).not.toContain(key);
    }
    expect(replicaTags).toContain("role");
    expect(replicaTags).toContain("stack");
    expect(tableTags).toContain("stack");
  });

  it("keeps build tags on other resources", () => {
    const template = synth({
      commit: "aaaaaaaaaaaaaaaa",
      date: FIRST_BUILD,
      version: "1.0.0",
    });

    const bucket = Object.values(template.findResources("AWS::S3::Bucket"))[0];
    const bucketTags = tagKeys(bucket.Properties.Tags);

    for (const key of BUILD_TAGS) {
      expect(bucketTags).toContain(key);
    }
  });
});
