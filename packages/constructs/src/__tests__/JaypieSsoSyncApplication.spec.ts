import { afterEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "../constants";
import { JaypieSsoSyncApplication } from "../JaypieSsoSyncApplication.js";

//
//
// Constants
//

const TEST_PROPS = {
  googleAdminEmail: "admin@example.com",
  googleCredentials: "test-google-credentials",
  identityStoreId: "d-test12345",
  scimEndpointAccessToken: "test-scim-token",
  scimEndpointUrl: "https://scim.us-east-1.amazonaws.com/test/scim/v2",
};

const TEST_ENV_VARS = [
  "CDK_ENV_SSOSYNC_GOOGLE_ADMIN_EMAIL",
  "CDK_ENV_SSOSYNC_GOOGLE_CREDENTIALS",
  "CDK_ENV_SSOSYNC_GOOGLE_GROUP_MATCH",
  "CDK_ENV_SSOSYNC_IDENTITY_STORE_ID",
  "CDK_ENV_SCIM_ENDPOINT_ACCESS_TOKEN",
  "CDK_ENV_SSOSYNC_SCIM_ENDPOINT_URL",
  "CDK_ENV_SSOSYNC_SEMANTIC_VERSION",
  "CUSTOM_GOOGLE_ADMIN_EMAIL",
  "CUSTOM_GOOGLE_CREDS",
  "CUSTOM_GOOGLE_GROUP_MATCH",
  "CUSTOM_IDENTITY_STORE_ID",
  "CUSTOM_SCIM_TOKEN",
  "CUSTOM_SCIM_URL",
  "CUSTOM_SEMANTIC_VERSION",
];

//
//
// Tests
//

describe("JaypieSsoSyncApplication", () => {
  afterEach(() => {
    // Clean up environment variables after each test
    TEST_ENV_VARS.forEach((envVar) => {
      delete process.env[envVar];
    });
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieSsoSyncApplication).toBeFunction();
    });

    it("creates an SSO Sync application", () => {
      const stack = new Stack();
      const app = new JaypieSsoSyncApplication(
        stack,
        "TestSSOSync",
        TEST_PROPS,
      );
      const template = Template.fromStack(stack);

      expect(app).toBeDefined();
      template.resourceCountIs("AWS::Serverless::Application", 1);
    });
  });

  describe("Error Conditions", () => {
    it("throws ConfigurationError when googleAdminEmail is missing", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "TestSSOSync", {
          googleCredentials: "test-creds",
          identityStoreId: "d-test12345",
          scimEndpointAccessToken: "test-token",
          scimEndpointUrl: "https://scim.example.com",
        });
      }).toThrow();
    });

    it("throws ConfigurationError when googleCredentials is missing", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "TestSSOSync", {
          googleAdminEmail: "admin@example.com",
          identityStoreId: "d-test12345",
          scimEndpointAccessToken: "test-token",
          scimEndpointUrl: "https://scim.example.com",
        });
      }).toThrow();
    });

    it("throws ConfigurationError when identityStoreId is missing", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "TestSSOSync", {
          googleAdminEmail: "admin@example.com",
          googleCredentials: "test-creds",
          scimEndpointAccessToken: "test-token",
          scimEndpointUrl: "https://scim.example.com",
        });
      }).toThrow();
    });

    it("throws ConfigurationError when scimEndpointAccessToken is missing", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "TestSSOSync", {
          googleAdminEmail: "admin@example.com",
          googleCredentials: "test-creds",
          identityStoreId: "d-test12345",
          scimEndpointUrl: "https://scim.example.com",
        });
      }).toThrow();
    });

    it("throws ConfigurationError when scimEndpointUrl is missing", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "TestSSOSync", {
          googleAdminEmail: "admin@example.com",
          googleCredentials: "test-creds",
          identityStoreId: "d-test12345",
          scimEndpointAccessToken: "test-token",
        });
      }).toThrow();
    });

    it("throws ConfigurationError with multiple missing parameters", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack, "TestSSOSync", {});
      }).toThrow();

      const stack2 = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack2, "TestSSOSync2", {});
      }).toThrow(/googleAdminEmail/);

      const stack3 = new Stack();
      expect(() => {
        new JaypieSsoSyncApplication(stack3, "TestSSOSync3", {});
      }).toThrow(/googleCredentials/);
    });
  });

  describe("Features", () => {
    it("uses default application ID and version when not provided", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", TEST_PROPS);
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Location: {
          ApplicationId:
            "arn:aws:serverlessrepo:us-east-2:004480582608:applications/SSOSync",
          SemanticVersion: "2.3.3",
        },
      });
    });

    it("uses custom application ID and version when provided", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", {
        ...TEST_PROPS,
        semanticVersion: "3.0.0",
        ssoSyncApplicationId: "arn:aws:serverlessrepo:custom:application",
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Location: {
          ApplicationId: "arn:aws:serverlessrepo:custom:application",
          SemanticVersion: "3.0.0",
        },
      });
    });

    it("configures parameters correctly", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", TEST_PROPS);
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Parameters: {
          GoogleAdminEmail: "admin@example.com",
          GoogleCredentials: "test-google-credentials",
          GoogleGroupMatch: "name:AWS*",
          IdentityStoreID: "d-test12345",
          SCIMEndpointAccessToken: "test-scim-token",
          SCIMEndpointUrl: "https://scim.us-east-1.amazonaws.com/test/scim/v2",
        },
      });
    });

    it("uses custom google group match when provided", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", {
        ...TEST_PROPS,
        googleGroupMatch: "name:Custom*",
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Parameters: {
          GoogleGroupMatch: "name:Custom*",
        },
      });
    });

    it("uses default google group match when not provided", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", TEST_PROPS);
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Parameters: {
          GoogleGroupMatch: "name:AWS*",
        },
      });
    });

    it("reads all configuration from environment variables", () => {
      process.env.CDK_ENV_SSOSYNC_GOOGLE_ADMIN_EMAIL = "env-admin@example.com";
      process.env.CDK_ENV_SSOSYNC_GOOGLE_CREDENTIALS = "env-google-creds";
      process.env.CDK_ENV_SSOSYNC_GOOGLE_GROUP_MATCH = "name:EnvGroup*";
      process.env.CDK_ENV_SSOSYNC_IDENTITY_STORE_ID = "d-env123";
      process.env.CDK_ENV_SCIM_ENDPOINT_ACCESS_TOKEN = "env-scim-token";
      process.env.CDK_ENV_SSOSYNC_SCIM_ENDPOINT_URL =
        "https://scim.example.com/env";
      process.env.CDK_ENV_SSOSYNC_SEMANTIC_VERSION = "2.4.0";

      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync");
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Location: {
          SemanticVersion: "2.4.0",
        },
        Parameters: {
          GoogleAdminEmail: "env-admin@example.com",
          GoogleCredentials: "env-google-creds",
          GoogleGroupMatch: "name:EnvGroup*",
          IdentityStoreID: "d-env123",
          SCIMEndpointAccessToken: "env-scim-token",
          SCIMEndpointUrl: "https://scim.example.com/env",
        },
      });
    });

    it("props override environment variables", () => {
      process.env.CDK_ENV_SSOSYNC_GOOGLE_ADMIN_EMAIL = "env-admin@example.com";
      process.env.CDK_ENV_SSOSYNC_GOOGLE_CREDENTIALS = "env-google-creds";
      process.env.CDK_ENV_SSOSYNC_IDENTITY_STORE_ID = "d-env123";
      process.env.CDK_ENV_SCIM_ENDPOINT_ACCESS_TOKEN = "env-scim-token";
      process.env.CDK_ENV_SSOSYNC_SCIM_ENDPOINT_URL =
        "https://scim.example.com/env";

      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", {
        googleAdminEmail: "props-admin@example.com",
        googleCredentials: "props-creds",
        identityStoreId: "d-props123",
        scimEndpointAccessToken: "props-token",
        scimEndpointUrl: "https://scim.example.com/props",
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Parameters: {
          GoogleAdminEmail: "props-admin@example.com",
          GoogleCredentials: "props-creds",
          IdentityStoreID: "d-props123",
          SCIMEndpointAccessToken: "props-token",
          SCIMEndpointUrl: "https://scim.example.com/props",
        },
      });
    });

    it("uses custom environment variable keys when provided", () => {
      process.env.CUSTOM_GOOGLE_ADMIN_EMAIL = "custom-admin@example.com";
      process.env.CUSTOM_GOOGLE_CREDS = "custom-env-google-creds";
      process.env.CUSTOM_GOOGLE_GROUP_MATCH = "name:CustomEnv*";
      process.env.CUSTOM_IDENTITY_STORE_ID = "d-custom123";
      process.env.CUSTOM_SCIM_TOKEN = "custom-env-scim-token";
      process.env.CUSTOM_SCIM_URL = "https://scim.example.com/custom";
      process.env.CUSTOM_SEMANTIC_VERSION = "2.5.0";

      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", {
        googleAdminEmailEnvKey: "CUSTOM_GOOGLE_ADMIN_EMAIL",
        googleCredentialsEnvKey: "CUSTOM_GOOGLE_CREDS",
        googleGroupMatchEnvKey: "CUSTOM_GOOGLE_GROUP_MATCH",
        identityStoreIdEnvKey: "CUSTOM_IDENTITY_STORE_ID",
        scimEndpointAccessTokenEnvKey: "CUSTOM_SCIM_TOKEN",
        scimEndpointUrlEnvKey: "CUSTOM_SCIM_URL",
        semanticVersionEnvKey: "CUSTOM_SEMANTIC_VERSION",
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Location: {
          SemanticVersion: "2.5.0",
        },
        Parameters: {
          GoogleAdminEmail: "custom-admin@example.com",
          GoogleCredentials: "custom-env-google-creds",
          GoogleGroupMatch: "name:CustomEnv*",
          IdentityStoreID: "d-custom123",
          SCIMEndpointAccessToken: "custom-env-scim-token",
          SCIMEndpointUrl: "https://scim.example.com/custom",
        },
      });
    });

    it("adds security role tag by default", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", TEST_PROPS);
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Tags: {
          [CDK.TAG.ROLE]: CDK.ROLE.SECURITY,
        },
      });
    });

    it("allows custom tags to be added", () => {
      const stack = new Stack();
      new JaypieSsoSyncApplication(stack, "TestSSOSync", {
        ...TEST_PROPS,
        tags: {
          CustomTag: "custom-value",
          Environment: "test",
        },
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Serverless::Application", {
        Tags: {
          [CDK.TAG.ROLE]: CDK.ROLE.SECURITY,
          CustomTag: "custom-value",
          Environment: "test",
        },
      });
    });

    it("exposes application through getter", () => {
      const stack = new Stack();
      const app = new JaypieSsoSyncApplication(
        stack,
        "TestSSOSync",
        TEST_PROPS,
      );

      expect(app.application).toBeDefined();
    });
  });
});
