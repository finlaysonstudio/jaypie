#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { JaypieDynamoDb } from "@jaypie/constructs";
import { DocumentationStack } from "../lib/documentation-stack";
import { GardenApiStack } from "../lib/garden-api-stack";
import { GardenDataStack } from "../lib/garden-data-stack";
import { GardenNextjsStack } from "../lib/garden-nextjs-stack";

const app = new cdk.App();

// Support selective stack synthesis via context: -c stacks=JaypieGardenApi
const stacksContext = app.node.tryGetContext("stacks") as string | undefined;
const selectedStacks = stacksContext?.split(",").map((s) => s.trim()) ?? [];
const shouldInclude = (stackId: string) =>
  selectedStacks.length === 0 || selectedStacks.includes(stackId);

if (shouldInclude("JaypieDocumentation")) {
  new DocumentationStack(app, "JaypieDocumentation");
}

let gardenTable: JaypieDynamoDb | undefined;

if (shouldInclude("JaypieGardenData")) {
  const dataStack = new GardenDataStack(app, "JaypieGardenData");
  gardenTable = dataStack.table;
}
if (shouldInclude("JaypieGardenApi")) {
  new GardenApiStack(app, "JaypieGardenApi", { table: gardenTable });
}
if (shouldInclude("JaypieGardenNextjs")) {
  new GardenNextjsStack(app, "JaypieGardenNextjs", { table: gardenTable });
}

app.synth();
