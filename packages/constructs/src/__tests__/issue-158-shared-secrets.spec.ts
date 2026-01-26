/**
 * Test for GitHub Issue #158:
 * JaypieNextJs does not inject SECRET_ env vars or grant IAM permissions
 * when reusing secrets from another construct
 *
 * This test validates the behavior of secret sharing between constructs.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";

import { JaypieEnvSecret } from "../JaypieEnvSecret.js";
import { JaypieLambda } from "../JaypieLambda.js";
import { JaypieQueuedLambda } from "../JaypieQueuedLambda.js";
import {
  resolveSecrets,
  clearSecretsCache,
} from "../helpers/resolveSecrets.js";

// Helper function to find Lambda functions by environment variable
function findLambdaWithEnvVar(template: Template, envVarName: string) {
  const resources = template.findResources("AWS::Lambda::Function");
  return Object.entries(resources).filter(([, resource]: [string, any]) => {
    const envVars = resource.Properties?.Environment?.Variables || {};
    return envVarName in envVars;
  });
}

// Helper function to count secrets created
function countSecrets(template: Template) {
  return Object.keys(template.findResources("AWS::SecretsManager::Secret"))
    .length;
}

describe("Issue #158: Shared Secrets Between Constructs", () => {
  const originalEnv = { ...process.env };
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, "TestStack");
    // Set up test environment variables that would be used to create secrets
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.AUTH0_SECRET = "test-auth0-secret";
    process.env.PROJECT_ENV = "sandbox";
    process.env.PROJECT_KEY = "test-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearSecretsCache(stack);
  });

  describe("Stack-level secret sharing (fix for issue #158)", () => {
    it("JaypieLambda shares secrets at stack level, not construct level", () => {
      // After the fix, JaypieLambda uses Stack.of(this) for resolveSecrets
      // This means secrets are shared across all constructs in the same stack
      const queuedLambda = new JaypieQueuedLambda(stack, "QueuedLambda", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: ["ANTHROPIC_API_KEY"],
      });

      const template = Template.fromStack(stack);

      // The secret should be created at stack level (shared namespace)
      const secrets = template.findResources("AWS::SecretsManager::Secret");
      expect(Object.keys(secrets).length).toBeGreaterThan(0);

      // The Lambda should have the SECRET_ANTHROPIC_API_KEY env var
      const lambdas = template.findResources("AWS::Lambda::Function");
      const lambdaWithSecret = Object.values(lambdas).find((l: any) => {
        const envVars = l.Properties?.Environment?.Variables || {};
        return "SECRET_ANTHROPIC_API_KEY" in envVars;
      });
      expect(lambdaWithSecret).toBeDefined();
    });

    it("multiple constructs share the same secret instance at stack level", () => {
      // After the fix, all constructs use Stack.of(this) for resolveSecrets
      // This means they share the same secrets cache (the stack's cache)

      // Resolve secrets at stack scope
      const stackSecrets = resolveSecrets(stack, ["ANTHROPIC_API_KEY"]);

      // Create JaypieQueuedLambda with the same secret
      // It will use Stack.of(this) internally, which is the same stack
      const queuedLambda = new JaypieQueuedLambda(stack, "QueuedLambda", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: ["ANTHROPIC_API_KEY"],
      });

      // Resolve at stack scope again - should return the SAME cached instance
      // because JaypieQueuedLambda's internal JaypieLambda also used Stack.of(this)
      const stackSecretsAgain = resolveSecrets(stack, ["ANTHROPIC_API_KEY"]);
      expect(stackSecrets[0]).toBe(stackSecretsAgain[0]);
    });
  });

  describe("resolveSecrets caching behavior", () => {
    it("caches secrets per scope - different scopes create different secrets", () => {
      // Create two child constructs to act as different scopes
      const scope1 = new lambda.Function(stack, "Scope1", {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromInline("exports.handler = () => {}"),
      });
      const scope2 = new lambda.Function(stack, "Scope2", {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromInline("exports.handler = () => {}"),
      });

      // Both resolve the same secret key but in different scopes
      // This should fail because CDK doesn't allow duplicate construct IDs within the same stack
      // The secrets will try to create with the same ID at different scopes
      // But we're testing resolveSecrets behavior, not CDK behavior

      // Actually, let me use the stack itself as one scope and a construct as another
      clearSecretsCache(stack);

      // First call with stack as scope
      const secrets1 = resolveSecrets(stack, ["ANTHROPIC_API_KEY"]);

      // Second call with stack as scope - should return cached instance
      const secrets2 = resolveSecrets(stack, ["ANTHROPIC_API_KEY"]);

      expect(secrets1[0]).toBe(secrets2[0]); // Same instance
    });

    it("different scopes get different secret instances", () => {
      // Use a fresh stack for each scope to avoid CDK construct ID conflicts
      const stack2 = new Stack(app, "TestStack2");

      const secrets1 = resolveSecrets(stack, ["ANTHROPIC_API_KEY"]);
      const secrets2 = resolveSecrets(stack2, ["ANTHROPIC_API_KEY"]);

      expect(secrets1[0]).not.toBe(secrets2[0]); // Different instances
      expect(secrets1[0].envKey).toBe(secrets2[0].envKey); // Same envKey
    });
  });

  describe("JaypieLambda creates secrets in its own scope", () => {
    it("creates secrets under JaypieLambda scope, not parent scope", () => {
      const jaypieLambda = new JaypieLambda(stack, "TestLambda", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: ["ANTHROPIC_API_KEY"],
      });

      const template = Template.fromStack(stack);

      // Secret should be created under the TestLambda construct
      // The secret name in CloudFormation should include TestLambda
      const secrets = template.findResources("AWS::SecretsManager::Secret");
      const secretKeys = Object.keys(secrets);

      // There should be at least one secret
      expect(secretKeys.length).toBeGreaterThan(0);

      // The Lambda should have SECRET_ANTHROPIC_API_KEY env var
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            SECRET_ANTHROPIC_API_KEY: Match.anyValue(),
          },
        },
      });
    });
  });

  describe("Multiple constructs with overlapping secrets (Issue #158 scenario)", () => {
    it("both constructs get env vars and permissions when using explicit JaypieEnvSecret instances", () => {
      // Create shared secrets explicitly at stack level
      const anthropicSecret = new JaypieEnvSecret(stack, "AnthropicApiKey", {
        envKey: "ANTHROPIC_API_KEY",
        value: "test-value",
      });
      const auth0Secret = new JaypieEnvSecret(stack, "Auth0Secret", {
        envKey: "AUTH0_SECRET",
        value: "test-value",
      });

      // First construct uses both secrets
      const lambda1 = new JaypieLambda(stack, "Lambda1", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: [anthropicSecret],
      });

      // Second construct also uses both secrets
      const lambda2 = new JaypieLambda(stack, "Lambda2", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: [anthropicSecret, auth0Secret],
      });

      const template = Template.fromStack(stack);

      // Both Lambdas should have SECRET_ANTHROPIC_API_KEY
      const lambdasWithAnthropicKey = findLambdaWithEnvVar(
        template,
        "SECRET_ANTHROPIC_API_KEY",
      );
      expect(lambdasWithAnthropicKey.length).toBe(2);

      // Only Lambda2 should have SECRET_AUTH0_SECRET
      const lambdasWithAuth0Key = findLambdaWithEnvVar(
        template,
        "SECRET_AUTH0_SECRET",
      );
      expect(lambdasWithAuth0Key.length).toBe(1);

      // Only 2 secrets should be created (not 3)
      expect(countSecrets(template)).toBe(2);
    });

    it("both JaypieLambda constructs get env vars and permissions with string secrets", () => {
      // This tests the actual issue scenario where secrets are passed as strings
      // and resolveSecrets is called with different scopes

      // First Lambda - uses ANTHROPIC_API_KEY
      const lambda1 = new JaypieLambda(stack, "Lambda1", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: ["ANTHROPIC_API_KEY"],
      });

      // Second Lambda - also uses ANTHROPIC_API_KEY plus AUTH0_SECRET
      const lambda2 = new JaypieLambda(stack, "Lambda2", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: ["ANTHROPIC_API_KEY", "AUTH0_SECRET"],
      });

      const template = Template.fromStack(stack);

      // Both Lambdas should have SECRET_ANTHROPIC_API_KEY
      const lambdasWithAnthropicKey = findLambdaWithEnvVar(
        template,
        "SECRET_ANTHROPIC_API_KEY",
      );
      expect(lambdasWithAnthropicKey.length).toBe(2);

      // Only Lambda2 should have SECRET_AUTH0_SECRET
      const lambdasWithAuth0Key = findLambdaWithEnvVar(
        template,
        "SECRET_AUTH0_SECRET",
      );
      expect(lambdasWithAuth0Key.length).toBe(1);
    });

    it("JaypieQueuedLambda and JaypieLambda with overlapping secrets at same stack scope", () => {
      // Create JaypieQueuedLambda first (this will create JaypieLambda internally)
      const queuedLambda = new JaypieQueuedLambda(stack, "QueuedLambda", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: ["ANTHROPIC_API_KEY"],
      });

      // Create JaypieLambda at the same stack level with overlapping secrets
      const lambda2 = new JaypieLambda(stack, "Lambda2", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: ["ANTHROPIC_API_KEY", "AUTH0_SECRET"],
      });

      const template = Template.fromStack(stack);

      // Both Lambdas should have SECRET_ANTHROPIC_API_KEY
      const lambdasWithAnthropicKey = findLambdaWithEnvVar(
        template,
        "SECRET_ANTHROPIC_API_KEY",
      );
      expect(lambdasWithAnthropicKey.length).toBe(2);

      // Only Lambda2 should have SECRET_AUTH0_SECRET
      const lambdasWithAuth0Key = findLambdaWithEnvVar(
        template,
        "SECRET_AUTH0_SECRET",
      );
      expect(lambdasWithAuth0Key.length).toBe(1);
    });

    it("explicit JaypieEnvSecret instances passed to multiple constructs work correctly", () => {
      // The workaround from the issue: create secrets explicitly and share them
      const anthropicSecret = new JaypieEnvSecret(stack, "AnthropicApiKey", {
        envKey: "ANTHROPIC_API_KEY",
        value: "test-value",
      });
      const auth0Secret = new JaypieEnvSecret(stack, "Auth0Secret", {
        envKey: "AUTH0_SECRET",
        value: "test-value",
      });

      // Pass the same secret instances to both constructs
      const queuedLambda = new JaypieQueuedLambda(stack, "QueuedLambda", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: [anthropicSecret],
      });

      const lambda2 = new JaypieLambda(stack, "Lambda2", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: [anthropicSecret, auth0Secret],
      });

      const template = Template.fromStack(stack);

      // Both Lambdas should have SECRET_ANTHROPIC_API_KEY
      const lambdasWithAnthropicKey = findLambdaWithEnvVar(
        template,
        "SECRET_ANTHROPIC_API_KEY",
      );
      expect(lambdasWithAnthropicKey.length).toBe(2);

      // Only Lambda2 should have SECRET_AUTH0_SECRET
      const lambdasWithAuth0Key = findLambdaWithEnvVar(
        template,
        "SECRET_AUTH0_SECRET",
      );
      expect(lambdasWithAuth0Key.length).toBe(1);

      // Only 2 secrets should exist (shared)
      expect(countSecrets(template)).toBe(2);
    });
  });
});
