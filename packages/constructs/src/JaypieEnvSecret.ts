import { Construct } from "constructs";
import {
  CfnOutput,
  Fn,
  SecretValue,
  Tags,
  RemovalPolicy,
  Stack,
} from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import {
  ISecret,
  ISecretAttachmentTarget,
  RotationSchedule,
  RotationScheduleOptions,
} from "aws-cdk-lib/aws-secretsmanager";
import { IKey } from "aws-cdk-lib/aws-kms";
import {
  Grant,
  IGrantable,
  PolicyStatement,
  AddToResourcePolicyResult,
} from "aws-cdk-lib/aws-iam";

import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";

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

function exportEnvName(name: string, env = process.env): string {
  let rawName;
  if (checkEnvIsProvider(env)) {
    rawName = `env-${env.PROJECT_ENV}-${env.PROJECT_KEY}-${name}`;
    // Clean the entire name to only allow alphanumeric, colons, and hyphens
    return cleanName(rawName);
  } else {
    if (checkEnvIsConsumer(env)) {
      rawName = `env-${CDK.ENV.SANDBOX}-${env.PROJECT_KEY}-${name}`;
    } else {
      rawName = `env-${env.PROJECT_ENV}-${env.PROJECT_KEY}-${name}`;
    }
  }
  return cleanName(rawName);
}

export interface JaypieEnvSecretProps {
  consumer?: boolean;
  envKey?: string;
  export?: string;
  generateSecretString?: secretsmanager.SecretStringGenerator;
  provider?: boolean;
  removalPolicy?: boolean | RemovalPolicy;
  roleTag?: string;
  vendorTag?: string;
  value?: string;
}

export class JaypieEnvSecret extends Construct implements ISecret {
  private readonly _envKey?: string;
  private readonly _secret: secretsmanager.ISecret;

  constructor(
    scope: Construct,
    idOrEnvKey: string,
    props?: JaypieEnvSecretProps,
  ) {
    // Shorthand detection: treat idOrEnvKey as envKey when envKey prop is
    // not set and idOrEnvKey either looks like a SCREAMING_SNAKE_CASE env
    // var name or is already present in process.env. Convention-based
    // detection ensures missing env vars still go through envKey validation
    // instead of silently creating an empty secret.
    const looksLikeEnvKey = /^[A-Z][A-Z0-9_]*$/.test(idOrEnvKey);
    const treatAsEnvKey =
      (!props || props.envKey === undefined) &&
      (looksLikeEnvKey ||
        (typeof process.env[idOrEnvKey] === "string" &&
          process.env[idOrEnvKey] !== ""));

    const id = treatAsEnvKey ? `EnvSecret_${idOrEnvKey}` : idOrEnvKey;

    super(scope, id);

    const {
      consumer = checkEnvIsConsumer(),
      envKey: envKeyProp,
      export: exportParam,
      generateSecretString,
      provider = checkEnvIsProvider(),
      removalPolicy,
      roleTag,
      vendorTag,
      value,
    } = props || {};

    const envKey = treatAsEnvKey ? idOrEnvKey : envKeyProp;

    this._envKey = envKey;

    let exportName;

    if (!exportParam) {
      exportName = exportEnvName(id);
    } else {
      exportName = cleanName(exportParam);
    }

    if (
      !consumer &&
      envKey &&
      !process.env[envKey] &&
      value === undefined &&
      !generateSecretString
    ) {
      throw new ConfigurationError(
        `JaypieEnvSecret(${id}): envKey "${envKey}" is empty in process.env and no value or generateSecretString was provided`,
      );
    }

    if (consumer) {
      const secretName = Fn.importValue(exportName);
      this._secret = secretsmanager.Secret.fromSecretNameV2(
        this,
        id,
        secretName,
      );

      // Add CfnOutput for consumer secrets
      new CfnOutput(this, `ConsumedName`, {
        value: this._secret.secretName,
      });
    } else {
      const secretValue =
        envKey && process.env[envKey] ? process.env[envKey] : value;

      const secretProps: secretsmanager.SecretProps = {
        generateSecretString,
        secretStringValue:
          !generateSecretString && secretValue
            ? SecretValue.unsafePlainText(secretValue)
            : undefined,
      };

      this._secret = new secretsmanager.Secret(this, id, secretProps);

      if (removalPolicy !== undefined) {
        const policy =
          typeof removalPolicy === "boolean"
            ? removalPolicy
              ? RemovalPolicy.RETAIN
              : RemovalPolicy.DESTROY
            : removalPolicy;
        this._secret.applyRemovalPolicy(policy);
      }

      if (roleTag) {
        Tags.of(this._secret).add(CDK.TAG.ROLE, roleTag);
      }

      if (vendorTag) {
        Tags.of(this._secret).add(CDK.TAG.VENDOR, vendorTag);
      }

      if (provider) {
        new CfnOutput(this, `ProvidedName`, {
          value: this._secret.secretName,
          exportName,
        });
      } else {
        new CfnOutput(this, `CreatedName`, {
          value: this._secret.secretName,
        });
      }
    }
  }

  // IResource implementation
  public get stack(): Stack {
    return Stack.of(this);
  }

  public get env(): { account: string; region: string } {
    return {
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    };
  }

  public applyRemovalPolicy(policy: RemovalPolicy): void {
    this._secret.applyRemovalPolicy(policy);
  }

  // ISecret implementation
  public get secretArn(): string {
    return this._secret.secretArn;
  }

  public get secretFullArn(): string | undefined {
    return this._secret.secretFullArn;
  }

  public get secretName(): string {
    return this._secret.secretName;
  }

  public get secretRef(): secretsmanager.SecretReference {
    return this._secret.secretRef;
  }

  public get encryptionKey(): IKey | undefined {
    return this._secret.encryptionKey;
  }

  public get secretValue(): SecretValue {
    return this._secret.secretValue;
  }

  public secretValueFromJson(key: string): SecretValue {
    return this._secret.secretValueFromJson(key);
  }

  public grantRead(grantee: IGrantable, versionStages?: string[]): Grant {
    return this._secret.grantRead(grantee, versionStages);
  }

  public grantWrite(grantee: IGrantable): Grant {
    return this._secret.grantWrite(grantee);
  }

  public addRotationSchedule(
    id: string,
    options: RotationScheduleOptions,
  ): RotationSchedule {
    return this._secret.addRotationSchedule(id, options);
  }

  public addToResourcePolicy(
    statement: PolicyStatement,
  ): AddToResourcePolicyResult {
    return this._secret.addToResourcePolicy(statement);
  }

  public denyAccountRootDelete(): void {
    this._secret.denyAccountRootDelete();
  }

  public attach(target: ISecretAttachmentTarget): ISecret {
    return this._secret.attach(target);
  }

  public cfnDynamicReferenceKey(
    options?: Parameters<ISecret["cfnDynamicReferenceKey"]>[0],
  ): string {
    return this._secret.cfnDynamicReferenceKey(options);
  }

  public get envKey(): string | undefined {
    return this._envKey;
  }
}
