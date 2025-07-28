#!/usr/bin/env node

import cdk from "aws-cdk-lib";
import { AppStack } from "../lib/cdk-app.ts";
import { InfrastructureStack } from "../lib/cdk-infrastructure.ts";

const app = new cdk.App();

new InfrastructureStack(app, "InfrastructureStack");

new AppStack(app, "AppStack");
