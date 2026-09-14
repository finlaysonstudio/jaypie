import { Construct } from "constructs";
import { Annotations, Fn, SecretValue, Stack, Tags } from "aws-cdk-lib";
import { CfnApplication } from "aws-cdk-lib/aws-sam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";

//
//
// Constants
//

const DEFAULT_APPLICATION_ID =
  "arn:aws:serverlessrepo:us-east-2:004480582608:applications/SSOSync";
const DEFAULT_APPLICATION_VERSION = "2.3.3";
const DEFAULT_GOOGLE_GROUP_MATCH = "name:AWS*";
const DEPLOY_PATTERN_APP_ONLY = "App only";
const WARNING_LITERAL_CREDENTIALS =
  "@jaypie/constructs:ssoSyncLiteralCredentials";

//
//
// Types
//

export interface JaypieSsoSyncApplicationProps {
  googleAdminEmail?: string;
  googleAdminEmailEnvKey?: string;
  googleCredentials?: string;
  googleCredentialsEnvKey?: string;
  /**
   * Secret holding the Google credentials.json. With
   * `scimEndpointAccessTokenSecret`, deploys SSOSync as "App only" so no
   * credential enters the template. Requires a complete ARN (issue #551).
   */
  googleCredentialsSecret?: secretsmanager.ISecret;
  googleGroupMatch?: string;
  googleGroupMatchEnvKey?: string;
  identityStoreId?: string;
  identityStoreIdEnvKey?: string;
  scimEndpointAccessToken?: string;
  scimEndpointAccessTokenEnvKey?: string;
  /**
   * Secret holding the SCIM endpoint access token. Required with
   * `googleCredentialsSecret` (issue #551).
   */
  scimEndpointAccessTokenSecret?: secretsmanager.ISecret;
  scimEndpointUrl?: string;
  scimEndpointUrlEnvKey?: string;
  semanticVersion?: string;
  semanticVersionEnvKey?: string;
  ssoSyncApplicationId?: string;
  tags?: { [key: string]: string };
}

//
//
// Class
//

export class JaypieSsoSyncApplication extends Construct {
  private readonly _application: CfnApplication;

  constructor(
    scope: Construct,
    id = "SsoSyncApplication",
    props: JaypieSsoSyncApplicationProps = {},
  ) {
    super(scope, id);

    const {
      googleAdminEmail,
      googleAdminEmailEnvKey = "CDK_ENV_SSOSYNC_GOOGLE_ADMIN_EMAIL",
      googleCredentials,
      googleCredentialsEnvKey = "CDK_ENV_SSOSYNC_GOOGLE_CREDENTIALS",
      googleCredentialsSecret,
      googleGroupMatch,
      googleGroupMatchEnvKey = "CDK_ENV_SSOSYNC_GOOGLE_GROUP_MATCH",
      identityStoreId,
      identityStoreIdEnvKey = "CDK_ENV_SSOSYNC_IDENTITY_STORE_ID",
      scimEndpointAccessToken,
      scimEndpointAccessTokenEnvKey = "CDK_ENV_SCIM_ENDPOINT_ACCESS_TOKEN",
      scimEndpointAccessTokenSecret,
      scimEndpointUrl,
      scimEndpointUrlEnvKey = "CDK_ENV_SSOSYNC_SCIM_ENDPOINT_URL",
      semanticVersion,
      semanticVersionEnvKey = "CDK_ENV_SSOSYNC_SEMANTIC_VERSION",
      ssoSyncApplicationId = DEFAULT_APPLICATION_ID,
      tags,
    } = props;

    // Resolve all values from props or environment variables
    const resolvedGoogleAdminEmail =
      googleAdminEmail || process.env[googleAdminEmailEnvKey];
    const useSecrets = !!(
      googleCredentialsSecret || scimEndpointAccessTokenSecret
    );
    const resolvedGoogleCredentials = useSecrets
      ? undefined
      : googleCredentials || process.env[googleCredentialsEnvKey];
    const resolvedGoogleGroupMatch =
      googleGroupMatch ||
      process.env[googleGroupMatchEnvKey] ||
      DEFAULT_GOOGLE_GROUP_MATCH;
    const resolvedIdentityStoreId =
      identityStoreId || process.env[identityStoreIdEnvKey];
    const resolvedScimEndpointAccessToken = useSecrets
      ? undefined
      : scimEndpointAccessToken || process.env[scimEndpointAccessTokenEnvKey];
    const resolvedScimEndpointUrl =
      scimEndpointUrl || process.env[scimEndpointUrlEnvKey];
    const resolvedSemanticVersion =
      semanticVersion ||
      process.env[semanticVersionEnvKey] ||
      DEFAULT_APPLICATION_VERSION;

    // Validate required parameters
    const missingParams: string[] = [];

    if (!resolvedGoogleAdminEmail) {
      missingParams.push(
        `googleAdminEmail or ${googleAdminEmailEnvKey} environment variable`,
      );
    }
    if (useSecrets) {
      if (googleCredentials || scimEndpointAccessToken) {
        throw new ConfigurationError(
          "JaypieSsoSyncApplication cannot combine googleCredentials or scimEndpointAccessToken with secret props",
        );
      }
      if (!googleCredentialsSecret) {
        missingParams.push("googleCredentialsSecret");
      }
      if (!scimEndpointAccessTokenSecret) {
        missingParams.push("scimEndpointAccessTokenSecret");
      }
    }
    if (!useSecrets && !resolvedGoogleCredentials) {
      missingParams.push(
        `googleCredentials or ${googleCredentialsEnvKey} environment variable`,
      );
    }
    if (!resolvedIdentityStoreId) {
      missingParams.push(
        `identityStoreId or ${identityStoreIdEnvKey} environment variable`,
      );
    }
    if (!useSecrets && !resolvedScimEndpointAccessToken) {
      missingParams.push(
        `scimEndpointAccessToken or ${scimEndpointAccessTokenEnvKey} environment variable`,
      );
    }
    if (!resolvedScimEndpointUrl) {
      missingParams.push(
        `scimEndpointUrl or ${scimEndpointUrlEnvKey} environment variable`,
      );
    }

    if (missingParams.length > 0) {
      throw new ConfigurationError(
        `JaypieSsoSyncApplication missing required configuration: ${missingParams.join(", ")}`,
      );
    }

    // Create the SSO Sync Application
    // Type assertion is safe because we validated all required values above
    const location = {
      applicationId: ssoSyncApplicationId,
      semanticVersion: resolvedSemanticVersion,
    };

    if (useSecrets) {
      // "App only" reads six secret ARNs from CrossStackConfig, in this order,
      // and the SSOSync role grants read on exactly those ARNs. The
      // non-sensitive values become secrets this construct owns.
      const crossStackSecrets = [
        googleCredentialsSecret!,
        this.createValueSecret("GoogleAdminEmail", resolvedGoogleAdminEmail!),
        this.createValueSecret("ScimEndpointUrl", resolvedScimEndpointUrl!),
        scimEndpointAccessTokenSecret!,
        this.createValueSecret("Region", Stack.of(this).region),
        this.createValueSecret("IdentityStoreId", resolvedIdentityStoreId!),
      ];

      const secretArns = crossStackSecrets.map((secret) => {
        if (!secret.secretFullArn) {
          throw new ConfigurationError(
            `JaypieSsoSyncApplication requires secrets with a complete ARN; "${secret.node.path}" has a partial ARN. Import with Secret.fromSecretCompleteArn`,
          );
        }
        return secret.secretFullArn;
      });

      this._application = new CfnApplication(this, "Application", {
        location,
        parameters: {
          CrossStackConfig: Fn.join(",", secretArns),
          DeployPattern: DEPLOY_PATTERN_APP_ONLY,
          GoogleGroupMatch: resolvedGoogleGroupMatch,
        },
      });
    } else {
      Annotations.of(this).addWarningV2(
        WARNING_LITERAL_CREDENTIALS,
        'JaypieSsoSyncApplication writes googleCredentials and scimEndpointAccessToken into the template. Pass googleCredentialsSecret and scimEndpointAccessTokenSecret instead. See skill("secrets").',
      );

      this._application = new CfnApplication(this, "Application", {
        location,
        parameters: {
          GoogleAdminEmail: resolvedGoogleAdminEmail!,
          GoogleCredentials: resolvedGoogleCredentials!,
          GoogleGroupMatch: resolvedGoogleGroupMatch,
          IdentityStoreID: resolvedIdentityStoreId!,
          Region: Stack.of(this).region,
          SCIMEndpointAccessToken: resolvedScimEndpointAccessToken!,
          SCIMEndpointUrl: resolvedScimEndpointUrl!,
        },
      });
    }

    // Add tags
    const defaultTags = {
      [CDK.TAG.ROLE]: CDK.ROLE.SECURITY,
    };

    const allTags = { ...defaultTags, ...tags };
    Object.entries(allTags).forEach(([key, value]) => {
      Tags.of(this._application).add(key, value);
    });
  }

  private createValueSecret(id: string, value: string): secretsmanager.Secret {
    return new secretsmanager.Secret(this, id, {
      secretStringValue: SecretValue.unsafePlainText(value),
    });
  }

  public get application(): CfnApplication {
    return this._application;
  }
}
