import { Construct } from "constructs";
import { RemovalPolicy, SecretValue, Stack, Tags } from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import {
  ISecret,
  ISecretAttachmentTarget,
  RotationSchedule,
  RotationScheduleOptions,
} from "aws-cdk-lib/aws-secretsmanager";
import { IKey } from "aws-cdk-lib/aws-kms";
import {
  AddToResourcePolicyResult,
  Grant,
  IGrantable,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";

import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";

export interface JaypieSecretProps {
  envKey?: string;
  generateSecretString?: secretsmanager.SecretStringGenerator;
  removalPolicy?: boolean | RemovalPolicy;
  roleTag?: string;
  vendorTag?: string;
  value?: string;
}

/**
 * Context handed to {@link JaypieSecret.buildSecret} so subclasses can build the
 * underlying secret differently (e.g. import vs. create) while reusing the
 * shared id/envKey resolution and the full ISecret passthrough.
 */
export interface BuildSecretContext {
  envKey?: string;
  id: string;
  props: JaypieSecretProps;
  treatAsEnvKey: boolean;
}

export class JaypieSecret extends Construct implements ISecret {
  // Construct id prefix used when an envKey is detected via shorthand.
  // Subclasses override this to preserve their own naming conventions.
  protected static readonly shorthandPrefix: string = "Secret_";

  protected readonly _envKey?: string;
  protected readonly _secret: secretsmanager.ISecret;

  constructor(scope: Construct, idOrEnvKey: string, props?: JaypieSecretProps) {
    // Shorthand detection: treat idOrEnvKey as envKey when envKey prop is
    // not set and idOrEnvKey either looks like a SCREAMING_SNAKE_CASE env
    // var name or is already present in process.env. Convention-based
    // detection ensures missing env vars still go through envKey validation
    // instead of silently creating an empty secret.
    const prefix = (new.target as typeof JaypieSecret).shorthandPrefix;
    const looksLikeEnvKey = /^[A-Z][A-Z0-9_]*$/.test(idOrEnvKey);
    const treatAsEnvKey =
      (!props || props.envKey === undefined) &&
      (looksLikeEnvKey ||
        (typeof process.env[idOrEnvKey] === "string" &&
          process.env[idOrEnvKey] !== ""));

    const id = treatAsEnvKey ? `${prefix}${idOrEnvKey}` : idOrEnvKey;

    super(scope, id);

    const envKey = treatAsEnvKey ? idOrEnvKey : props?.envKey;
    this._envKey = envKey;

    this._secret = this.buildSecret({
      envKey,
      id,
      props: props || {},
      treatAsEnvKey,
    });
  }

  /**
   * Builds the underlying secret. The base implementation always creates a new
   * Secrets Manager secret from an envKey value, an explicit value, or a
   * generated string. Subclasses may override to import an existing secret or
   * emit cross-stack outputs.
   */
  protected buildSecret(context: BuildSecretContext): secretsmanager.ISecret {
    const { envKey, id, props } = context;
    const { generateSecretString, removalPolicy, roleTag, vendorTag, value } =
      props;

    if (
      envKey &&
      !process.env[envKey] &&
      value === undefined &&
      !generateSecretString
    ) {
      throw new ConfigurationError(
        `JaypieSecret(${id}): envKey "${envKey}" is empty in process.env and no value or generateSecretString was provided`,
      );
    }

    const secretValue =
      envKey && process.env[envKey] ? process.env[envKey] : value;

    const secret = new secretsmanager.Secret(this, id, {
      generateSecretString,
      secretStringValue:
        !generateSecretString && secretValue
          ? SecretValue.unsafePlainText(secretValue)
          : undefined,
    });

    if (removalPolicy !== undefined) {
      const policy =
        typeof removalPolicy === "boolean"
          ? removalPolicy
            ? RemovalPolicy.RETAIN
            : RemovalPolicy.DESTROY
          : removalPolicy;
      secret.applyRemovalPolicy(policy);
    }

    if (roleTag) {
      Tags.of(secret).add(CDK.TAG.ROLE, roleTag);
    }

    if (vendorTag) {
      Tags.of(secret).add(CDK.TAG.VENDOR, vendorTag);
    }

    return secret;
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
