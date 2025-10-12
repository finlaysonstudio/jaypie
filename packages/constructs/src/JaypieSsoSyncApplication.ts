import { Construct } from "constructs";
import { Stack, Tags } from "aws-cdk-lib";
import { CfnApplication } from "aws-cdk-lib/aws-sam";
import { CDK, ConfigurationError } from "@jaypie/cdk";

//
//
// Constants
//

const DEFAULT_APPLICATION_ID =
  "arn:aws:serverlessrepo:us-east-2:004480582608:applications/SSOSync";
const DEFAULT_APPLICATION_VERSION = "2.3.3";
const DEFAULT_GOOGLE_GROUP_MATCH = "name:AWS*";

//
//
// Types
//

export interface JaypieSsoSyncApplicationProps {
  googleAdminEmail?: string;
  googleAdminEmailEnvKey?: string;
  googleCredentials?: string;
  googleCredentialsEnvKey?: string;
  googleGroupMatch?: string;
  googleGroupMatchEnvKey?: string;
  identityStoreId?: string;
  identityStoreIdEnvKey?: string;
  scimEndpointAccessToken?: string;
  scimEndpointAccessTokenEnvKey?: string;
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
      googleGroupMatch,
      googleGroupMatchEnvKey = "CDK_ENV_SSOSYNC_GOOGLE_GROUP_MATCH",
      identityStoreId,
      identityStoreIdEnvKey = "CDK_ENV_SSOSYNC_IDENTITY_STORE_ID",
      scimEndpointAccessToken,
      scimEndpointAccessTokenEnvKey = "CDK_ENV_SCIM_ENDPOINT_ACCESS_TOKEN",
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
    const resolvedGoogleCredentials =
      googleCredentials || process.env[googleCredentialsEnvKey];
    const resolvedGoogleGroupMatch =
      googleGroupMatch ||
      process.env[googleGroupMatchEnvKey] ||
      DEFAULT_GOOGLE_GROUP_MATCH;
    const resolvedIdentityStoreId =
      identityStoreId || process.env[identityStoreIdEnvKey];
    const resolvedScimEndpointAccessToken =
      scimEndpointAccessToken || process.env[scimEndpointAccessTokenEnvKey];
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
    if (!resolvedGoogleCredentials) {
      missingParams.push(
        `googleCredentials or ${googleCredentialsEnvKey} environment variable`,
      );
    }
    if (!resolvedIdentityStoreId) {
      missingParams.push(
        `identityStoreId or ${identityStoreIdEnvKey} environment variable`,
      );
    }
    if (!resolvedScimEndpointAccessToken) {
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
    this._application = new CfnApplication(this, "Application", {
      location: {
        applicationId: ssoSyncApplicationId,
        semanticVersion: resolvedSemanticVersion,
      },
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

    // Add tags
    const defaultTags = {
      [CDK.TAG.ROLE]: CDK.ROLE.SECURITY,
    };

    const allTags = { ...defaultTags, ...tags };
    Object.entries(allTags).forEach(([key, value]) => {
      Tags.of(this._application).add(key, value);
    });
  }

  public get application(): CfnApplication {
    return this._application;
  }
}
