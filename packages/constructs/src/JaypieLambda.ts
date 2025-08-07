import { Construct } from "constructs";
import { Duration, Tags, Stack, RemovalPolicy } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { CDK } from "@jaypie/cdk";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { JaypieEnvSecret } from "./JaypieEnvSecret.js";

export interface JaypieLambdaProps {
  code: lambda.Code | string;
  datadogApiKeyArn?: string;
  environment?: { [key: string]: string };
  envSecrets?: { [key: string]: secretsmanager.ISecret };
  handler: string;
  layers?: lambda.ILayerVersion[];
  logRetention?: number;
  memorySize?: number;
  paramsAndSecrets?: lambda.ParamsAndSecretsLayerVersion | boolean;
  paramsAndSecretsOptions?: {
    cacheSize?: number;
    logLevel?: lambda.ParamsAndSecretsLogLevel;
    parameterStoreTtl?: number;
    secretsManagerTtl?: number;
  };
  provisionedConcurrentExecutions?: number;
  reservedConcurrentExecutions?: number;
  roleTag?: string;
  runtime?: lambda.Runtime;
  secrets?: JaypieEnvSecret[];
  timeout?: Duration | number;
  vendorTag?: string;
}

export class JaypieLambda extends Construct implements lambda.IFunction {
  private readonly _lambda: lambda.Function;
  private readonly _provisioned?: lambda.Alias;
  private readonly _code: lambda.Code;
  private readonly _reference: lambda.IFunction;

  constructor(scope: Construct, id: string, props: JaypieLambdaProps) {
    super(scope, id);

    const {
      code,
      datadogApiKeyArn,
      environment: initialEnvironment = {},
      envSecrets = {},
      handler = "index.handler",
      layers = [],
      logRetention = CDK.LAMBDA.LOG_RETENTION,
      memorySize = CDK.LAMBDA.MEMORY_SIZE,
      paramsAndSecrets,
      paramsAndSecretsOptions,
      provisionedConcurrentExecutions,
      reservedConcurrentExecutions,
      roleTag = CDK.ROLE.PROCESSING,
      runtime = lambda.Runtime.NODEJS_22_X,
      secrets = [],
      timeout = Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
      vendorTag,
    } = props;

    // Create a mutable copy of the environment variables
    let environment = { ...initialEnvironment };

    // Default environment values
    const defaultEnvValues: { [key: string]: string } = {
      AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING: "true",
    };

    // Apply default environment values with user overrides
    Object.entries(defaultEnvValues).forEach(([key, defaultValue]) => {
      if (key in initialEnvironment) {
        const userValue = initialEnvironment[key];
        // If user passes a string, use that value
        if (typeof userValue === "string") {
          environment[key] = userValue;
        }
        // If user passes non-string falsy value, omit the key
        else if (!userValue) {
          delete environment[key];
        }
        // Ignore non-string truthy values (key already not present)
      } else {
        // No user override, use default value
        environment[key] = defaultValue;
      }
    });

    // Default environment variables from process.env if present
    const defaultEnvVars = [
      "DATADOG_API_KEY_ARN",
      "LOG_LEVEL",
      "MODULE_LOGGER",
      "MODULE_LOG_LEVEL",
      "PROJECT_COMMIT",
      "PROJECT_ENV",
      "PROJECT_KEY",
      "PROJECT_SECRET",
      "PROJECT_SERVICE",
      "PROJECT_SPONSOR",
      "PROJECT_VERSION",
    ];

    // Add default environment variables if they exist in process.env
    defaultEnvVars.forEach((envVar) => {
      if (process.env[envVar] && !environment[envVar]) {
        environment[envVar] = process.env[envVar]!;
      }
    });

    this._code = typeof code === "string" ? lambda.Code.fromAsset(code) : code;

    // Create a working copy of layers
    const resolvedLayers = [...layers];

    // Determine if we should add Datadog integration
    // Check for datadog API key ARN in different sources
    const resolvedDatadogApiKeyArn =
      datadogApiKeyArn ||
      process.env.DATADOG_API_KEY_ARN ||
      process.env.CDK_ENV_DATADOG_API_KEY_ARN;

    // Add Datadog integration if API key is available
    if (resolvedDatadogApiKeyArn) {
      // Add Datadog Node.js layer
      const datadogNodeLayer = lambda.LayerVersion.fromLayerVersionArn(
        this,
        "DatadogNodeLayer",
        `arn:aws:lambda:${Stack.of(this).region}:464622532012:layer:Datadog-Node20-x:${CDK.DATADOG.LAYER.NODE}`,
      );
      resolvedLayers.push(datadogNodeLayer);

      // Add Datadog Extension layer
      const datadogExtensionLayer = lambda.LayerVersion.fromLayerVersionArn(
        this,
        "DatadogExtensionLayer",
        `arn:aws:lambda:${Stack.of(this).region}:464622532012:layer:Datadog-Extension:${CDK.DATADOG.LAYER.EXTENSION}`,
      );
      resolvedLayers.push(datadogExtensionLayer);

      // Set Datadog environment variables
      Object.assign(environment, {
        DD_API_KEY_SECRET_ARN: resolvedDatadogApiKeyArn,
        DD_ENHANCED_METRICS: "true",
        DD_ENV: process.env.PROJECT_ENV || "",
        DD_PROFILING_ENABLED: "false",
        DD_SERVERLESS_APPSEC_ENABLED: "false",
        DD_SERVICE: process.env.PROJECT_SERVICE || "",
        DD_SITE: CDK.DATADOG.SITE,
        DD_TAGS: `${CDK.TAG.SPONSOR}:${process.env.PROJECT_SPONSOR || ""}`,
        DD_TRACE_OTEL_ENABLED: "false",
      });
    }

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
      code: this._code,
      environment: {
        ...environment,
        ...secretsEnvironment,
        ...jaypieSecretsEnvironment,
      },
      handler,
      layers: resolvedLayers,
      logRetention,
      memorySize,
      paramsAndSecrets: resolvedParamsAndSecrets,
      reservedConcurrentExecutions,
      runtime,
      timeout:
        typeof timeout === "number" ? Duration.seconds(timeout) : timeout,
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

    // Grant secret read permissions
    Object.values(envSecrets).forEach((secret) => {
      secret.grantRead(this._lambda);
    });

    // Grant read permissions for JaypieEnvSecrets
    secrets.forEach((secret) => {
      secret.grantRead(this._lambda);
    });

    // Grant Datadog API key read permission if applicable
    if (resolvedDatadogApiKeyArn) {
      const datadogApiKey = secretsmanager.Secret.fromSecretCompleteArn(
        this,
        "DatadogApiKeyGrant",
        resolvedDatadogApiKeyArn,
      );
      datadogApiKey.grantRead(this._lambda);
    }

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

  public get code(): lambda.Code {
    return this._code;
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

  public addEnvironment(
    key: string,
    value: string,
    options?: lambda.EnvironmentOptions,
  ): lambda.Function {
    return this._lambda.addEnvironment(key, value, options);
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

  // Additional IFunction implementation
  public grantInvokeLatestVersion(grantee: iam.IGrantable): iam.Grant {
    return this._reference.grantInvokeLatestVersion(grantee);
  }

  public grantInvokeVersion(
    grantee: iam.IGrantable,
    version: lambda.Version,
  ): iam.Grant {
    return this._reference.grantInvokeVersion(grantee, version);
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
