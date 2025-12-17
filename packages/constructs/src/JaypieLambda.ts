import { Construct } from "constructs";
import { Duration, Stack, RemovalPolicy, Tags } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { CDK } from "./constants";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import {
  addDatadogLayers,
  EnvironmentInput,
  jaypieLambdaEnv,
  resolveEnvironment,
  resolveParamsAndSecrets,
  resolveSecrets,
  SecretsArrayItem,
} from "./helpers/index.js";

export interface JaypieLambdaProps {
  allowAllOutbound?: boolean;
  allowPublicSubnet?: boolean;
  architecture?: lambda.Architecture;
  code: lambda.Code | string;
  datadogApiKeyArn?: string;
  deadLetterQueue?: import("aws-cdk-lib/aws-sqs").IQueue;
  deadLetterQueueEnabled?: boolean;
  deadLetterTopic?: import("aws-cdk-lib/aws-sns").ITopic;
  description?: string;
  /**
   * Environment variables for the Lambda function.
   *
   * Supports both legacy object syntax and new array syntax:
   * - Object: { KEY: "value" } - directly sets environment variables
   * - Array: ["KEY1", "KEY2", { KEY3: "value" }]
   *   - Strings: lookup value from process.env
   *   - Objects: merge key-value pairs directly
   */
  environment?: EnvironmentInput;
  envSecrets?: { [key: string]: secretsmanager.ISecret };
  ephemeralStorageSize?: import("aws-cdk-lib").Size;
  filesystem?: lambda.FileSystem;
  handler: string;
  initialPolicy?: iam.PolicyStatement[];
  layers?: lambda.ILayerVersion[];
  logGroup?: logs.ILogGroup;
  logRetention?: logs.RetentionDays | number;
  maxEventAge?: Duration;
  memorySize?: number;
  paramsAndSecrets?: lambda.ParamsAndSecretsLayerVersion | boolean;
  paramsAndSecretsOptions?: {
    cacheSize?: number;
    logLevel?: lambda.ParamsAndSecretsLogLevel;
    parameterStoreTtl?: Duration;
    secretsManagerTtl?: Duration;
  };
  profiling?: boolean;
  profilingGroup?: import("aws-cdk-lib/aws-codeguruprofiler").IProfilingGroup;
  provisionedConcurrentExecutions?: number;
  reservedConcurrentExecutions?: number;
  retryAttempts?: number;
  roleTag?: string;
  runtime?: lambda.Runtime;
  runtimeManagementMode?: lambda.RuntimeManagementMode;
  /**
   * Secrets to make available to the Lambda function.
   *
   * Supports both JaypieEnvSecret instances and strings:
   * - JaypieEnvSecret: used directly
   * - String: creates a JaypieEnvSecret with the string as envKey
   *   (reuses existing secrets within the same scope)
   */
  secrets?: SecretsArrayItem[];
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
      datadogApiKeyArn,
      deadLetterQueue,
      deadLetterQueueEnabled,
      deadLetterTopic,
      description,
      environment: environmentInput,
      envSecrets = {},
      ephemeralStorageSize,
      filesystem,
      handler = "index.handler",
      initialPolicy,
      layers = [],
      logGroup,
      logRetention = CDK.LAMBDA.LOG_RETENTION,
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
      runtime = new lambda.Runtime("nodejs24.x", lambda.RuntimeFamily.NODEJS, {
        supportsInlineCode: true,
      }),
      runtimeManagementMode,
      secrets: secretsInput = [],
      securityGroups,
      timeout = Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
      tracing,
      vendorTag,
      vpc,
      vpcSubnets,
    } = props;

    // Resolve environment from array or object syntax
    const initialEnvironment = resolveEnvironment(environmentInput);

    // Get base environment with defaults
    const environment = jaypieLambdaEnv({ initialEnvironment });

    // Resolve secrets from mixed array (strings and JaypieEnvSecret instances)
    const secrets = resolveSecrets(scope, secretsInput);

    const codeAsset =
      typeof code === "string" ? lambda.Code.fromAsset(code) : code;

    // Create a working copy of layers
    const resolvedLayers = [...layers];

    // Process secrets environment variables
    const secretsEnvironment = Object.entries(envSecrets).reduce(
      (acc, [key, secret]) => ({
        ...acc,
        [`SECRET_${key}`]: secret.secretName,
      }),
      {},
    );

    // Process JaypieEnvSecret array
    const jaypieSecretsEnvironment = secrets.reduce<{ [key: string]: string }>(
      (acc, secret) => {
        if (secret.envKey) {
          return {
            ...acc,
            [`SECRET_${secret.envKey}`]: secret.secretName,
          };
        }
        return acc;
      },
      {},
    );

    // Add ParamsAndSecrets layer if configured
    const resolvedParamsAndSecrets = resolveParamsAndSecrets({
      paramsAndSecrets,
      options: paramsAndSecretsOptions,
    });

    // Create LogGroup if not provided
    const resolvedLogGroup =
      logGroup ??
      new logs.LogGroup(this, "LogGroup", {
        retention: logRetention as logs.RetentionDays,
        removalPolicy: RemovalPolicy.DESTROY,
      });

    // Create Lambda Function
    this._lambda = new lambda.Function(this, "Function", {
      allowAllOutbound,
      allowPublicSubnet,
      architecture,
      code: codeAsset,
      deadLetterQueue,
      deadLetterQueueEnabled,
      deadLetterTopic,
      description,
      environment: {
        ...environment,
        ...secretsEnvironment,
        ...jaypieSecretsEnvironment,
      },
      ephemeralStorageSize,
      filesystem,
      handler,
      initialPolicy,
      layers: resolvedLayers,
      logGroup: resolvedLogGroup,
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

    addDatadogLayers(this._lambda, { datadogApiKeyArn });

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

  public get functionRef(): lambda.FunctionReference {
    return {
      functionArn: this._reference.functionArn,
      functionName: this._reference.functionName,
    };
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

  public addEnvironment(key: string, value: string): void {
    this._lambda.addEnvironment(key, value);
  }
}
