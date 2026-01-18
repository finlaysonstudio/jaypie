#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DocumentationStack } from "../lib/documentation-stack";

const app = new cdk.App();

new DocumentationStack(app, "JaypieDocumentation");

app.synth();
