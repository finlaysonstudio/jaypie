---
trigger: model_decision
description: When asked to create a new workspace or subpackage for cdk, usually packages/cdk
---

# Jaypie Initialize CDK Subpackage

## Process

1. Follow Jaypie_Init_Project_Subpackage.md:
   * Use @project-org/cdk in packages/cdk
   * Skip the src structure

2. Copy template files:
   * Copy `prompts/templates/cdk-subpackage/bin/cdk.ts` to `packages/cdk/bin/cdk.ts`
   * Copy `prompts/templates/cdk-subpackage/lib/cdk-app.ts` to `packages/cdk/lib/cdk-app.ts`
   * Copy `prompts/templates/cdk-subpackage/lib/cdk-infrastructure.ts` to `packages/cdk/lib/cdk-infrastructure.ts`
   * Copy `prompts/templates/cdk-subpackage/cdk.json` to `packages/cdk/cdk.json`

3. Update package.json:
   * Add `"bin": {"cdk": "dist/cdk.js"}`
   * In `scripts`,
       * Make `"clean": "rimfaf cdk.out",`
       * Add `"cdk": "cdk",`
   * Run `npm run format:package`

4. Install dependencies:
   * `npm --workspace ./packages/cdk install @jaypie/constructs aws-cdk-lib constructs`
   * `npm --workspace ./packages/cdk install --save-dev aws-cdk`
   * Always run `npm install`, never update package.json with dependencies from memory

5. Update TypeScript build:
   * Update packages/cdk/tsconfig.json and packages/cdk/vite.config.ts to build from bin and lib while creating dist/cdk.js
   * Test the build
   * Make sure `cdk.out` is in gitignore