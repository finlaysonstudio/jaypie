import { Construct } from "constructs";
import { CfnOutput, Fn } from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

import { CDK } from "./constants";
import {
  BuildSecretContext,
  JaypieSecret,
  JaypieSecretProps,
} from "./JaypieSecret";

// It is a consumer if the environment is ephemeral
function checkEnvIsConsumer(env = process.env): boolean {
  return (
    env.PROJECT_ENV === CDK.ENV.PERSONAL ||
    !!env.CDK_ENV_PERSONAL ||
    /** @deprecated */ env.PROJECT_ENV === "ephemeral" ||
    /** @deprecated */ !!env.CDK_ENV_EPHEMERAL
  );
}

function checkEnvIsProvider(env = process.env): boolean {
  return env.PROJECT_ENV === CDK.ENV.SANDBOX;
}

function cleanName(name: string): string {
  return name.replace(/[^a-zA-Z0-9:-]/g, "");
}

function exportEnvName(
  name: string,
  env = process.env,
  consumer = false,
): string {
  let rawName;
  if (checkEnvIsProvider(env)) {
    rawName = `env-${env.PROJECT_ENV}-${env.PROJECT_KEY}-${name}`;
    // Clean the entire name to only allow alphanumeric, colons, and hyphens
    return cleanName(rawName);
  } else {
    if (consumer || checkEnvIsConsumer(env)) {
      rawName = `env-${CDK.ENV.SANDBOX}-${env.PROJECT_KEY}-${name}`;
    } else {
      rawName = `env-${env.PROJECT_ENV}-${env.PROJECT_KEY}-${name}`;
    }
  }
  return cleanName(rawName);
}

export interface JaypieEnvSecretProps extends JaypieSecretProps {
  consumer?: boolean;
  export?: string;
  provider?: boolean;
}

/**
 * @deprecated Use {@link JaypieSecret}. JaypieEnvSecret layers an
 * environment-driven provider/consumer cross-stack pattern on top of
 * JaypieSecret and will be removed in 2.0.
 */
export class JaypieEnvSecret extends JaypieSecret {
  protected static readonly className: string = "JaypieEnvSecret";
  protected static readonly shorthandPrefix: string = "EnvSecret_";

  constructor(
    scope: Construct,
    idOrEnvKey: string,
    props?: JaypieEnvSecretProps,
  ) {
    super(scope, idOrEnvKey, props);
  }

  protected buildSecret(context: BuildSecretContext): secretsmanager.ISecret {
    const { id } = context;
    const props = context.props as JaypieEnvSecretProps;
    const {
      consumer = checkEnvIsConsumer(),
      export: exportParam,
      provider = checkEnvIsProvider(),
    } = props;

    let exportName;

    if (!exportParam) {
      // Always derive the export name from the construct id so the name is
      // stable across both call forms. For shorthand detection the id carries
      // the "EnvSecret_" prefix; for the explicit (id, { envKey }) form the id
      // is the caller's construct id. Deriving from envKey instead would change
      // the export name for an unchanged explicit-form call site across a
      // version bump and break existing cross-stack imports (issues #347, #365).
      const exportSource = id;
      exportName = exportEnvName(exportSource, process.env, consumer);
    } else {
      exportName = cleanName(exportParam);
    }

    if (consumer) {
      const secretName = Fn.importValue(exportName);
      const secret = secretsmanager.Secret.fromSecretNameV2(
        this,
        id,
        secretName,
      );

      // Add CfnOutput for consumer secrets
      new CfnOutput(this, `ConsumedName`, {
        value: secret.secretName,
      });

      return secret;
    }

    const secret = this.createSecret(context);

    if (provider) {
      new CfnOutput(this, `ProvidedName`, {
        value: secret.secretName,
        exportName,
      });
    } else {
      new CfnOutput(this, `CreatedName`, {
        value: secret.secretName,
      });
    }

    return secret;
  }
}
