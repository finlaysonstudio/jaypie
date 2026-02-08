#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DocumentationStack } from "../lib/documentation-stack";
import { GardenApiStack } from "../lib/garden-api-stack";
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
if (shouldInclude("JaypieGardenApi")) {
  new GardenApiStack(app, "JaypieGardenApi");
}
if (shouldInclude("JaypieGardenNextjs")) {
  new GardenNextjsStack(app, "JaypieGardenNextjs");
}

app.synth();
