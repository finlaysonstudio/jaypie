import { Construct } from "constructs";
import { Duration, Stack, RemovalPolicy, Tags } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { CDK } from "@jaypie/cdk";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { JaypieEnvSecret } from "./JaypieEnvSecret.js";
import { addDatadogLayer, jaypieLambdaEnv } from "./helpers/index.js";

export interface JaypieLambdaProps {
  allowAllOutbound?: boolean;
  allowPublicSubnet?: boolean;
  architecture?: lambda.Architecture;
  code: lambda.Code | string;
  codeSigningConfig?: lambda.ICodeSigningConfig;
  datadogApiKeyArn?: string;
  deadLetterQueue?: import("aws-cdk-lib/aws-sqs").IQueue;
  deadLetterQueueEnabled?: boolean;
  deadLetterTopic?: import("aws-cdk-lib/aws-sns").ITopic;
  description?: string;
  environment?: { [key: string]: string };
  environmentEncryption?: import("aws-cdk-lib/aws-kms").IKey;
  envSecrets?: { [key: string]: secretsmanager.ISecret };
  ephemeralStorageSize?: import("aws-cdk-lib").Size;
  filesystem?: lambda.FileSystem;
  handler: string;
  initialPolicy?: iam.PolicyStatement[];
  layers?: lambda.ILayerVersion[];
  logRetention?: number;
  logRetentionRole?: iam.IRole;
  logRetentionRetryOptions?: lambda.LogRetentionRetryOptions;
  maxEventAge?: Duration;
  memorySize?: number;
  paramsAndSecrets?: lambda.ParamsAndSecretsLayerVersion | boolean;
  paramsAndSecretsOptions?: {
    cacheSize?: number;
    logLevel?: lambda.ParamsAndSecretsLogLevel;
    parameterStoreTtl?: number;
    secretsManagerTtl?: number;
  };
  profiling?: boolean;
  profilingGroup?: import("aws-cdk-lib/aws-codeguruprofiler").IProfilingGroup;
  provisionedConcurrentExecutions?: number;
  reservedConcurrentExecutions?: number;
  retryAttempts?: number;
  roleTag?: string;
  runtime?: lambda.Runtime;
  runtimeManagementMode?: lambda.RuntimeManagementMode;
  secrets?: JaypieEnvSecret[];
  securityGroups?: ec2.ISecurityGroup[];
  timeout?: Duration | number;
  tracing?: lambda.Tracing;
  vendorTag?: string;
  vpc?: ec2.IVpc;
  vpcSubnets?: ec2.SubnetSelection;
}

export class JaypieLambda extends Construct implements lambda.IFunction {
  private readonly _lambda: lambda.Function;
  private readonly _provisioned?: lambda.Alias;
  private readonly _reference: lambda.IFunction;

  constructor(scope: Construct, id: string, props: JaypieLambdaProps) {
    super(scope, id);

    const {
      allowAllOutbound,
      allowPublicSubnet,
      architecture = lambda.Architecture.X86_64,
      code,
      codeSigningConfig,
      datadogApiKeyArn,
      deadLetterQueue,
      deadLetterQueueEnabled,
      deadLetterTopic,
      description,
      environment: initialEnvironment = {},
      environmentEncryption,
      envSecrets = {},
      ephemeralStorageSize,
      filesystem,
      handler = "index.handler",
      initialPolicy,
      layers = [],
      logRetention = CDK.LAMBDA.LOG_RETENTION,
      logRetentionRole,
      logRetentionRetryOptions,
      maxEventAge,
      memorySize = CDK.LAMBDA.MEMORY_SIZE,
      paramsAndSecrets,
      paramsAndSecretsOptions,
      profiling,
      profilingGroup,
      provisionedConcurrentExecutions,
      reservedConcurrentExecutions,
      retryAttempts,
      roleTag = CDK.ROLE.PROCESSING,
      runtime = lambda.Runtime.NODEJS_22_X,
      runtimeManagementMode,
      secrets = [],
      securityGroups,
      timeout = Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
      tracing,
      vendorTag,
      vpc,
      vpcSubnets,
    } = props;

    // Get base environment with defaults
    const environment = jaypieLambdaEnv({ initialEnvironment });

    const codeAsset =
      typeof code === "string" ? lambda.Code.fromAsset(code) : code;

    // Create a working copy of layers
    const resolvedLayers = [...layers];

    // Configure ParamsAndSecrets layer
    let resolvedParamsAndSecrets:
      | lambda.ParamsAndSecretsLayerVersion
      | undefined = undefined;

    if (paramsAndSecrets !== false) {
      if (paramsAndSecrets instanceof lambda.ParamsAndSecretsLayerVersion) {
        resolvedParamsAndSecrets = paramsAndSecrets;
      } else {
        // Create default ParamsAndSecrets layer
        resolvedParamsAndSecrets =
          lambda.ParamsAndSecretsLayerVersion.fromVersion(
            lambda.ParamsAndSecretsVersions.V1_0_103,
            {
              cacheSize: paramsAndSecretsOptions?.cacheSize,
              logLevel:
                paramsAndSecretsOptions?.logLevel ||
                lambda.ParamsAndSecretsLogLevel.WARN,
              parameterStoreTtl: paramsAndSecretsOptions?.parameterStoreTtl
                ? Duration.seconds(paramsAndSecretsOptions.parameterStoreTtl)
                : undefined,
              secretsManagerTtl: paramsAndSecretsOptions?.secretsManagerTtl
                ? Duration.seconds(paramsAndSecretsOptions.secretsManagerTtl)
                : undefined,
            },
          );
      }
    }

    // Process secrets environment variables
    const secretsEnvironment = Object.entries(envSecrets).reduce(
      (acc, [key, secret]) => ({
        ...acc,
        [`SECRET_${key}`]: secret.secretName,
      }),
      {},
    );

    // Process JaypieEnvSecret array
    const jaypieSecretsEnvironment = secrets.reduce((acc, secret) => {
      if (secret.envKey) {
        return {
          ...acc,
          [`SECRET_${secret.envKey}`]: secret.secretName,
        };
      }
      return acc;
    }, {});

    // Create Lambda Function
    this._lambda = new lambda.Function(this, "Function", {
      allowAllOutbound,
      allowPublicSubnet,
      architecture,
      code: codeAsset,
      codeSigningConfig,
      deadLetterQueue,
      deadLetterQueueEnabled,
      deadLetterTopic,
      description,
      environment: {
        ...environment,
        ...secretsEnvironment,
        ...jaypieSecretsEnvironment,
      },
      environmentEncryption,
      ephemeralStorageSize,
      filesystem,
      handler,
      initialPolicy,
      layers: resolvedLayers,
      logRetention,
      logRetentionRole,
      logRetentionRetryOptions,
      maxEventAge,
      memorySize,
      paramsAndSecrets: resolvedParamsAndSecrets,
      profiling,
      profilingGroup,
      reservedConcurrentExecutions,
      retryAttempts,
      runtime,
      runtimeManagementMode,
      securityGroups,
      timeout:
        typeof timeout === "number" ? Duration.seconds(timeout) : timeout,
      tracing,
      vpc,
      vpcSubnets,
      // Enable auto-publishing of versions when using provisioned concurrency
      currentVersionOptions:
        provisionedConcurrentExecutions !== undefined
          ? {
              removalPolicy: RemovalPolicy.RETAIN,
              description: "Auto-published version for provisioned concurrency",
              // Don't set provisioned concurrency here - it will be set on the alias
            }
          : undefined,
    });

    // Add Datadog layers and environment variables if configured
    addDatadogLayer(this._lambda, { datadogApiKeyArn });

    // Grant secret read permissions
    Object.values(envSecrets).forEach((secret) => {
      secret.grantRead(this._lambda);
    });

    // Grant read permissions for JaypieEnvSecrets
    secrets.forEach((secret) => {
      secret.grantRead(this._lambda);
    });

    // Configure provisioned concurrency if specified
    if (provisionedConcurrentExecutions !== undefined) {
      // Use currentVersion which is auto-published with proper configuration
      const version = this._lambda.currentVersion;

      // Create alias for provisioned concurrency
      this._provisioned = new lambda.Alias(this, "ProvisionedAlias", {
        aliasName: "provisioned",
        version,
        provisionedConcurrentExecutions,
      });

      // Add explicit dependencies to ensure proper creation order
      this._provisioned.node.addDependency(version);
    }

    if (roleTag) {
      Tags.of(this._lambda).add(CDK.TAG.ROLE, roleTag);
    }
    if (vendorTag) {
      Tags.of(this._lambda).add(CDK.TAG.VENDOR, vendorTag);
    }

    // Assign _reference based on provisioned state
    this._reference =
      this._provisioned !== undefined ? this._provisioned : this._lambda;
  }

  // Public accessors
  public get lambda(): lambda.Function {
    return this._lambda;
  }

  public get provisioned(): lambda.Alias | undefined {
    return this._provisioned;
  }

  public get reference(): lambda.IFunction {
    return this._reference;
  }

  // IFunction implementation
  public get functionArn(): string {
    return this._reference.functionArn;
  }

  public get functionName(): string {
    return this._reference.functionName;
  }

  public get grantPrincipal(): iam.IPrincipal {
    return this._reference.grantPrincipal;
  }

  public get role(): iam.IRole | undefined {
    return this._reference.role;
  }

  public get architecture(): lambda.Architecture {
    return this._reference.architecture;
  }

  public get connections(): import("aws-cdk-lib/aws-ec2").Connections {
    return this._reference.connections;
  }

  public get isBoundToVpc(): boolean {
    return this._reference.isBoundToVpc;
  }

  public get latestVersion(): lambda.IVersion {
    return this._reference.latestVersion;
  }

  public get permissionsNode(): import("constructs").Node {
    return this._reference.permissionsNode;
  }

  public get resourceArnsForGrantInvoke(): string[] {
    return this._reference.resourceArnsForGrantInvoke;
  }

  public addEventSource(source: lambda.IEventSource): void {
    this._reference.addEventSource(source);
  }

  public addEventSourceMapping(
    id: string,
    options: lambda.EventSourceMappingOptions,
  ): lambda.EventSourceMapping {
    return this._reference.addEventSourceMapping(id, options);
  }

  public addFunctionUrl(
    options?: lambda.FunctionUrlOptions,
  ): lambda.FunctionUrl {
    return this._reference.addFunctionUrl(options);
  }

  public addPermission(id: string, permission: lambda.Permission): void {
    this._reference.addPermission(id, permission);
  }

  public addToRolePolicy(statement: iam.PolicyStatement): void {
    this._reference.addToRolePolicy(statement);
  }

  public configureAsyncInvoke(options: lambda.EventInvokeConfigOptions): void {
    this._reference.configureAsyncInvoke(options);
  }

  public grantInvoke(grantee: iam.IGrantable): iam.Grant {
    return this._reference.grantInvoke(grantee);
  }

  public grantInvokeCompositePrincipal(
    compositePrincipal: iam.CompositePrincipal,
  ): iam.Grant[] {
    return this._reference.grantInvokeCompositePrincipal(compositePrincipal);
  }

  public grantInvokeUrl(grantee: iam.IGrantable): iam.Grant {
    return this._reference.grantInvokeUrl(grantee);
  }

  public grantInvokeLatestVersion(grantee: iam.IGrantable): iam.Grant {
    return this._reference.grantInvokeLatestVersion(grantee);
  }

  public grantInvokeVersion(
    grantee: iam.IGrantable,
    version: lambda.IVersion,
  ): iam.Grant {
    return this._reference.grantInvokeVersion(grantee, version);
  }

  public metric(
    metricName: string,
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._reference.metric(metricName, props);
  }

  public metricDuration(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this._reference.metricDuration(props);
  }

  public metricErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this._reference.metricErrors(props);
  }

  public metricInvocations(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._reference.metricInvocations(props);
  }

  public metricThrottles(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this._reference.metricThrottles(props);
  }

  public get env() {
    return {
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    };
  }

  public get stack(): Stack {
    return this._reference.stack;
  }

  public applyRemovalPolicy(policy: RemovalPolicy): void {
    this._reference.applyRemovalPolicy(policy);
  }
}
