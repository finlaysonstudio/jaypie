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
  environment?: { [key: string]: string };
  envSecrets?: { [key: string]: secretsmanager.ISecret };
  handler: string;
  layers?: lambda.ILayerVersion[];
  logRetention?: number;
  memorySize?: number;
  paramsAndSecrets?: lambda.ParamsAndSecretsLayerVersion;
  reservedConcurrentExecutions?: number;
  roleTag?: string;
  runtime?: lambda.Runtime;
  secrets?: JaypieEnvSecret[];
  timeout?: Duration | number;
  vendorTag?: string;
}

export class JaypieLambda extends Construct implements lambda.IFunction {
  private readonly _lambda: lambda.Function;
  private readonly _code: lambda.Code;

  constructor(scope: Construct, id: string, props: JaypieLambdaProps) {
    super(scope, id);

    const {
      code,
      environment = {},
      envSecrets = {},
      handler = "index.handler",
      layers = [],
      logRetention = CDK.LAMBDA.LOG_RETENTION,
      memorySize = CDK.LAMBDA.MEMORY_SIZE,
      paramsAndSecrets,
      reservedConcurrentExecutions,
      roleTag,
      runtime = lambda.Runtime.NODEJS_20_X,
      secrets = [],
      timeout = Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
      vendorTag,
    } = props;

    this._code = typeof code === "string" ? lambda.Code.fromAsset(code) : code;

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
      layers,
      logRetention,
      memorySize,
      paramsAndSecrets,
      reservedConcurrentExecutions,
      runtime,
      timeout:
        typeof timeout === "number" ? Duration.seconds(timeout) : timeout,
    });

    // Grant secret read permissions
    Object.values(envSecrets).forEach((secret) => {
      secret.grantRead(this._lambda);
    });

    // Grant read permissions for JaypieEnvSecrets
    secrets.forEach((secret) => {
      secret.grantRead(this);
      secret.grantRead(this._lambda);
    });

    if (roleTag) {
      Tags.of(this._lambda).add(CDK.TAG.ROLE, roleTag);
    }
    if (vendorTag) {
      Tags.of(this._lambda).add(CDK.TAG.VENDOR, vendorTag);
    }
  }

  // Public accessors
  public get lambda(): lambda.Function {
    return this._lambda;
  }

  public get code(): lambda.Code {
    return this._code;
  }

  // IFunction implementation
  public get functionArn(): string {
    return this._lambda.functionArn;
  }

  public get functionName(): string {
    return this._lambda.functionName;
  }

  public get grantPrincipal(): iam.IPrincipal {
    return this._lambda.grantPrincipal;
  }

  public get role(): iam.IRole | undefined {
    return this._lambda.role;
  }

  public get architecture(): lambda.Architecture {
    return this._lambda.architecture;
  }

  public get connections(): import("aws-cdk-lib/aws-ec2").Connections {
    return this._lambda.connections;
  }

  public get isBoundToVpc(): boolean {
    return this._lambda.isBoundToVpc;
  }

  public get latestVersion(): lambda.IVersion {
    return this._lambda.latestVersion;
  }

  public get permissionsNode(): import("constructs").Node {
    return this._lambda.permissionsNode;
  }

  public get resourceArnsForGrantInvoke(): string[] {
    return this._lambda.resourceArnsForGrantInvoke;
  }

  public addEventSource(source: lambda.IEventSource): void {
    this._lambda.addEventSource(source);
  }

  public addEventSourceMapping(
    id: string,
    options: lambda.EventSourceMappingOptions,
  ): lambda.EventSourceMapping {
    return this._lambda.addEventSourceMapping(id, options);
  }

  public addFunctionUrl(
    options?: lambda.FunctionUrlOptions,
  ): lambda.FunctionUrl {
    return this._lambda.addFunctionUrl(options);
  }

  public addPermission(id: string, permission: lambda.Permission): void {
    this._lambda.addPermission(id, permission);
  }

  public addToRolePolicy(statement: iam.PolicyStatement): void {
    this._lambda.addToRolePolicy(statement);
  }

  public configureAsyncInvoke(options: lambda.EventInvokeConfigOptions): void {
    this._lambda.configureAsyncInvoke(options);
  }

  public grantInvoke(grantee: iam.IGrantable): iam.Grant {
    return this._lambda.grantInvoke(grantee);
  }

  public grantInvokeCompositePrincipal(
    compositePrincipal: iam.CompositePrincipal,
  ): iam.Grant[] {
    return this._lambda.grantInvokeCompositePrincipal(compositePrincipal);
  }

  public grantInvokeUrl(grantee: iam.IGrantable): iam.Grant {
    return this._lambda.grantInvokeUrl(grantee);
  }

  public metric(
    metricName: string,
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._lambda.metric(metricName, props);
  }

  public metricDuration(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._lambda.metricDuration(props);
  }

  public metricErrors(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._lambda.metricErrors(props);
  }

  public metricInvocations(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._lambda.metricInvocations(props);
  }

  public metricThrottles(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._lambda.metricThrottles(props);
  }

  // Additional IFunction implementation
  public grantInvokeLatestVersion(grantee: iam.IGrantable): iam.Grant {
    return this._lambda.grantInvokeLatestVersion(grantee);
  }

  public grantInvokeVersion(
    grantee: iam.IGrantable,
    version: lambda.Version,
  ): iam.Grant {
    return this._lambda.grantInvokeVersion(grantee, version);
  }

  public get env() {
    return {
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    };
  }

  public get stack(): Stack {
    return this._lambda.stack;
  }

  public applyRemovalPolicy(policy: RemovalPolicy): void {
    this._lambda.applyRemovalPolicy(policy);
  }
}