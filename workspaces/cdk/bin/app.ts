#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CicdStack } from "../lib/cicd-stack";
import { DocumentationStack } from "../lib/documentation-stack";

const app = new cdk.App();

// Support selective stack synthesis via context: -c stacks=JaypieDocumentation
const stacksContext = app.node.tryGetContext("stacks") as string | undefined;
const selectedStacks = stacksContext?.split(",").map((s) => s.trim()) ?? [];
const shouldInclude = (stackId: string) =>
  selectedStacks.length === 0 || selectedStacks.includes(stackId);

if (shouldInclude("JaypieCicd")) {
  new CicdStack(app, "JaypieCicd");
}

if (shouldInclude("JaypieDocumentation")) {
  new DocumentationStack(app, "JaypieDocumentation");
}

app.synth();
