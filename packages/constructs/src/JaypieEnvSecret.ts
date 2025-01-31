import { Construct } from "constructs";
import { CfnOutput, Fn, SecretValue, Tags } from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { CDK } from "@jaypie/cdk";

// It is a consumer if the environment is ephemeral
function checkEnvIsConsumer(env = process.env) {
  return process.env.CDK_ENV_EPHEMERAL || env.PROJECT_ENV === CDK.ENV.EPHEMERAL;
}

function checkEnvIsProvider(env = process.env) {
  return env.PROJECT_ENV === CDK.ENV.SANDBOX;
}

function exportEnvName(name: string, env = process.env) {
  let rawName;
  if (checkEnvIsProvider(env)) {
    rawName = `env-${env.PROJECT_ENV}-${env.PROJECT_KEY}-${name}`;
    // Clean the entire name to only allow alphanumeric, colons, and hyphens
    return rawName.replace(/[^a-zA-Z0-9:-]/g, "");
  } else {
    rawName = `env-${CDK.ENV.SANDBOX}-${env.PROJECT_KEY}-${name}`;
  }
  return rawName.replace(/[^a-zA-Z0-9:-]/g, "");
}

export class JaypieEnvSecret extends Construct {
  constructor(scope, id, props) {
    // * Do not call super. Return the secret. Pass scope instead of this.
    // super(scope, id);

    const {
      consumer = checkEnvIsConsumer(),
      export: exportParam,
      provider = checkEnvIsProvider(),
      role,
      value,
    } = props;

    let secret;
    let exportName;

    if (!exportParam) {
      exportName = exportEnvName(id);
    } else {
      exportName = exportParam;
    }

    if (consumer) {
      const secretName = Fn.importValue(exportName);
      secret = secretsmanager.Secret.fromSecretNameV2(scope, id, secretName);

      // Add CfnOutput for consumer secrets
      new CfnOutput(scope, `Consumed${id}Name`, {
        value: secret.secretName,
      });
    } else {
      const secretProps = {};

      if (value) {
        secretProps.secretStringValue = SecretValue.unsafePlainText(value);
      }

      secret = new secretsmanager.Secret(scope, id, secretProps);

      if (role) {
        Tags.of(secret).add(CDK.TAG.ROLE, role);
      }

      if (provider) {
        new CfnOutput(scope, `Provided${id}Name`, {
          value: secret.secretName,
          exportName,
        });
      } else {
        new CfnOutput(scope, `Created${id}Name`, {
          value: secret.secretName,
          exportName,
        });
      }
    }

    return secret;
  }
}
