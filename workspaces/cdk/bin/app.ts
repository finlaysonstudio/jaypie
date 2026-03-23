#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
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

let gardenDataStack: GardenDataStack | undefined;

if (shouldInclude("JaypieGardenData")) {
  gardenDataStack = new GardenDataStack(app, "JaypieGardenData");
}
if (shouldInclude("JaypieGardenApi")) {
  new GardenApiStack(app, "JaypieGardenApi", {
    salt: gardenDataStack?.projectSalt,
    table: gardenDataStack?.table,
  });
}
if (shouldInclude("JaypieGardenNextjs")) {
  new GardenNextjsStack(app, "JaypieGardenNextjs", {
    salt: gardenDataStack?.projectSalt,
    table: gardenDataStack?.table,
  });
}

app.synth();
