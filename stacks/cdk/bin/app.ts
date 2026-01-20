#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DocumentationStack } from "../lib/documentation-stack";
import { GardenApiStack } from "../lib/garden-api-stack";
import { GardenNextjsStack } from "../lib/garden-nextjs-stack";

const app = new cdk.App();

new DocumentationStack(app, "JaypieDocumentation");
new GardenApiStack(app, "JaypieGardenApi");
new GardenNextjsStack(app, "JaypieGardenNextjs");

app.synth();
