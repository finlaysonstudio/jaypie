import { afterEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { ConfigurationError } from "@jaypie/errors";

import { JaypieEnvSecret } from "../JaypieEnvSecret.js";
import { JaypieSecret } from "../JaypieSecret.js";
import { JaypieSsoSyncApplication } from "../JaypieSsoSyncApplication.js";

//
//
// Constants
//

const COMPLETE_SECRET_ARN =
  "arn:aws:secretsmanager:us-east-1:123456789012:secret:google-credentials-AbCdEf";
const PARTIAL_SECRET_ARN =
  "arn:aws:secretsmanager:us-east-1:123456789012:secret:google-credentials";
const PLACEHOLDER_GOOGLE_CREDENTIALS = "PLACEHOLDER_GOOGLE_CREDENTIALS";
const PLACEHOLDER_SCIM_TOKEN = "PLACEHOLDER_SCIM_TOKEN";
const PLACEHOLDER_SECRET_VALUE = "PLACEHOLDER_SECRET_VALUE";

const SSO_VALUES = {
  googleAdminEmail: "admin@example.com",
  identityStoreId: "d-test12345",
  scimEndpointUrl: "https://scim.us-east-1.amazonaws.com/test/scim/v2",
};

const TEST_ENV_VARS = [
  "CDK_ENV_SCIM_ENDPOINT_ACCESS_TOKEN",
  "CDK_ENV_SSOSYNC_GOOGLE_CREDENTIALS",
  "ISSUE_551_API_KEY",
];

//
//
// Helpers
//

function templateText(stack: Stack): string {
  return JSON.stringify(Template.fromStack(stack).toJSON());
}

//
//
// Tests
//

describe("Issue 551: secret values stay out of templates", () => {
  afterEach(() => {
    TEST_ENV_VARS.forEach((envVar) => {
      delete process.env[envVar];
    });
  });

  describe("JaypieSecret external", () => {
    it("does not write an env-sourced value into the template", () => {
      process.env.ISSUE_551_API_KEY = PLACEHOLDER_SECRET_VALUE;
      const stack = new Stack();
      new JaypieSecret(stack, "ISSUE_551_API_KEY", { external: true });

      expect(templateText(stack)).not.toContain(PLACEHOLDER_SECRET_VALUE);
    });

    it("creates an empty secret with no SecretString or GenerateSecretString", () => {
      const stack = new Stack();
      const secret = new JaypieSecret(stack, "ISSUE_551_API_KEY", {
        external: true,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::SecretsManager::Secret", 1);
      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        GenerateSecretString: Match.absent(),
        SecretString: Match.absent(),
      });
      expect(secret.envKey).toBe("ISSUE_551_API_KEY");
    });

    it("outputs the secret ARN described by its envKey", () => {
      const stack = new Stack();
      new JaypieSecret(stack, "ISSUE_551_API_KEY", { external: true });

      const outputs = Template.fromStack(stack).findOutputs("*", {
        Description: "ISSUE_551_API_KEY",
      });
      expect(Object.keys(outputs)).toHaveLength(1);
    });

    it("throws ConfigurationError when combined with value", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "ApiKey", {
          external: true,
          value: PLACEHOLDER_SECRET_VALUE,
        });
      }).toThrow(ConfigurationError);
    });

    it("throws ConfigurationError when combined with generateSecretString", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "ApiKey", {
          external: true,
          generateSecretString: { passwordLength: 32 },
        });
      }).toThrow(ConfigurationError);
    });

    it("applies to JaypieEnvSecret", () => {
      process.env.ISSUE_551_API_KEY = PLACEHOLDER_SECRET_VALUE;
      const stack = new Stack();
      new JaypieEnvSecret(stack, "ISSUE_551_API_KEY", {
        consumer: false,
        external: true,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        GenerateSecretString: Match.absent(),
        SecretString: Match.absent(),
      });
      expect(templateText(stack)).not.toContain(PLACEHOLDER_SECRET_VALUE);
    });
  });

  describe("JaypieSsoSyncApplication secrets", () => {
    function createSecrets(stack: Stack) {
      return {
        googleCredentialsSecret: new JaypieSecret(stack, "GoogleCredentials", {
          external: true,
        }),
        scimEndpointAccessTokenSecret: new JaypieSecret(stack, "ScimToken", {
          external: true,
        }),
      };
    }

    it("does not write credentials into the template", () => {
      process.env.CDK_ENV_SSOSYNC_GOOGLE_CREDENTIALS =
        PLACEHOLDER_GOOGLE_CREDENTIALS;
      process.env.CDK_ENV_SCIM_ENDPOINT_ACCESS_TOKEN = PLACEHOLDER_SCIM_TOKEN;
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "SsoSync", {
        ...SSO_VALUES,
        ...createSecrets(stack),
      });

      const text = templateText(stack);
      expect(text).not.toContain(PLACEHOLDER_GOOGLE_CREDENTIALS);
      expect(text).not.toContain(PLACEHOLDER_SCIM_TOKEN);
    });

    it("deploys App only with six secret ARNs in CrossStackConfig", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "SsoSync", {
        ...SSO_VALUES,
        ...createSecrets(stack),
      });

      const template = Template.fromStack(stack);
      const [application] = Object.values(
        template.findResources("AWS::Serverless::Application"),
      ) as Array<{ Properties: { Parameters: Record<string, any> } }>;
      const parameters = application.Properties.Parameters;

      expect(parameters.DeployPattern).toBe("App only");
      expect(parameters.GoogleCredentials).toBeUndefined();
      expect(parameters.SCIMEndpointAccessToken).toBeUndefined();
      expect(parameters.CrossStackConfig["Fn::Join"][0]).toBe(",");
      expect(parameters.CrossStackConfig["Fn::Join"][1]).toHaveLength(6);
      // Two external secrets plus four construct-owned value secrets
      template.resourceCountIs("AWS::SecretsManager::Secret", 6);
    });

    it("orders CrossStackConfig as SSOSync reads it", () => {
      const stack = new Stack();
      const secrets = createSecrets(stack);
      new JaypieSsoSyncApplication(stack, "SsoSync", {
        ...SSO_VALUES,
        ...secrets,
      });

      const [application] = Object.values(
        Template.fromStack(stack).findResources("AWS::Serverless::Application"),
      ) as Array<{ Properties: { Parameters: Record<string, any> } }>;
      const arns = application.Properties.Parameters.CrossStackConfig[
        "Fn::Join"
      ][1] as Array<{ Ref: string }>;
      const resolve = (secret: JaypieSecret) => stack.resolve(secret.secretArn);

      expect(arns[0]).toEqual(resolve(secrets.googleCredentialsSecret));
      expect(arns[3]).toEqual(resolve(secrets.scimEndpointAccessTokenSecret));
    });

    it("accepts a secret imported by complete ARN", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "SsoSync", {
          ...SSO_VALUES,
          googleCredentialsSecret: secretsmanager.Secret.fromSecretCompleteArn(
            stack,
            "Imported",
            COMPLETE_SECRET_ARN,
          ),
          scimEndpointAccessTokenSecret:
            createSecrets(stack).scimEndpointAccessTokenSecret,
        });
      }).not.toThrow();
    });

    it("throws ConfigurationError for a secret with a partial ARN", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "SsoSync", {
          ...SSO_VALUES,
          googleCredentialsSecret: secretsmanager.Secret.fromSecretPartialArn(
            stack,
            "Imported",
            PARTIAL_SECRET_ARN,
          ),
          scimEndpointAccessTokenSecret:
            createSecrets(stack).scimEndpointAccessTokenSecret,
        });
      }).toThrow(ConfigurationError);
    });

    it("throws ConfigurationError when only one secret is provided", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "SsoSync", {
          ...SSO_VALUES,
          googleCredentialsSecret: createSecrets(stack).googleCredentialsSecret,
        });
      }).toThrow(ConfigurationError);
    });

    it("throws ConfigurationError when secrets are combined with literal credentials", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "SsoSync", {
          ...SSO_VALUES,
          ...createSecrets(stack),
          googleCredentials: PLACEHOLDER_GOOGLE_CREDENTIALS,
        });
      }).toThrow(ConfigurationError);
    });

    it("does not warn when secrets are provided", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "SsoSync", {
        ...SSO_VALUES,
        ...createSecrets(stack),
      });

      const warnings = Annotations.fromStack(stack).findWarning(
        "*",
        Match.stringLikeRegexp("writes googleCredentials"),
      );
      expect(warnings).toHaveLength(0);
    });

    it("warns when literal credentials are written into the template", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "SsoSync", {
        ...SSO_VALUES,
        googleCredentials: PLACEHOLDER_GOOGLE_CREDENTIALS,
        scimEndpointAccessToken: PLACEHOLDER_SCIM_TOKEN,
      });

      const warnings = Annotations.fromStack(stack).findWarning(
        "*",
        Match.stringLikeRegexp("writes googleCredentials"),
      );
      expect(warnings).toHaveLength(1);
    });
  });
});
