import { Construct } from "constructs";
import { Duration, Tags, Stack, RemovalPolicy } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { CDK } from "@jaypie/cdk";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as kms from "aws-cdk-lib/aws-kms";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { JaypieEnvSecret } from "./JaypieEnvSecret.js";

export interface JaypieQueuedLambdaProps {
  batchSize?: number;
  code: lambda.Code | string;
  environment?: { [key: string]: string };
  envSecrets?: { [key: string]: secretsmanager.ISecret };
  fifo?: boolean;
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
  visibilityTimeout?: Duration | number;
}

export class JaypieQueuedLambda
  extends Construct
  implements lambda.IFunction, sqs.IQueue
{
  private readonly _queue: sqs.Queue;
  private readonly _lambda: lambda.Function;
  private readonly _code: lambda.Code;

  constructor(scope: Construct, id: string, props: JaypieQueuedLambdaProps) {
    super(scope, id);

    const {
      batchSize = 1,
      code,
      environment = {},
      envSecrets = {},
      fifo = true,
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
      visibilityTimeout = Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
    } = props;

    this._code = typeof code === "string" ? lambda.Code.fromAsset(code) : code;

    // Create SQS Queue
    this._queue = new sqs.Queue(this, "Queue", {
      fifo,
      visibilityTimeout:
        typeof visibilityTimeout === "number"
          ? Duration.seconds(visibilityTimeout)
          : visibilityTimeout,
    });
    if (roleTag) {
      Tags.of(this._queue).add(CDK.TAG.ROLE, roleTag);
    }
    if (vendorTag) {
      Tags.of(this._queue).add(CDK.TAG.VENDOR, vendorTag);
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
        CDK_ENV_QUEUE_URL: this._queue.queueUrl,
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
      console.log("secret :>> ", secret.envKey);
      secret.grantRead(this._lambda);
    });

    this._queue.grantConsumeMessages(this._lambda);
    this._lambda.addEventSource(
      new lambdaEventSources.SqsEventSource(this._queue, {
        batchSize,
      }),
    );
    if (roleTag) {
      Tags.of(this._lambda).add(CDK.TAG.ROLE, roleTag);
    }
    if (vendorTag) {
      Tags.of(this._lambda).add(CDK.TAG.VENDOR, vendorTag);
    }
  }

  // Public accessors
  public get queue(): sqs.Queue {
    return this._queue;
  }

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

  public get grantPrincipal(): import("aws-cdk-lib/aws-iam").IPrincipal {
    return this._lambda.grantPrincipal;
  }

  public get role(): import("aws-cdk-lib/aws-iam").IRole | undefined {
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

  public addToRolePolicy(
    statement: import("aws-cdk-lib/aws-iam").PolicyStatement,
  ): void {
    this._lambda.addToRolePolicy(statement);
  }

  public configureAsyncInvoke(options: lambda.EventInvokeConfigOptions): void {
    this._lambda.configureAsyncInvoke(options);
  }

  public grantInvoke(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._lambda.grantInvoke(grantee);
  }

  public grantInvokeCompositePrincipal(
    compositePrincipal: import("aws-cdk-lib/aws-iam").CompositePrincipal,
  ): import("aws-cdk-lib/aws-iam").Grant[] {
    return this._lambda.grantInvokeCompositePrincipal(compositePrincipal);
  }

  public grantInvokeUrl(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._lambda.grantInvokeUrl(grantee);
  }

  public metric(
    metricName: string,
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambda.metric(metricName, props);
  }

  public metricDuration(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambda.metricDuration(props);
  }

  public metricErrors(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambda.metricErrors(props);
  }

  public metricInvocations(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambda.metricInvocations(props);
  }

  public metricThrottles(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
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
    this._queue.applyRemovalPolicy(policy);
  }

  // IQueue implementation
  public get fifo(): boolean {
    return this._queue.fifo;
  }

  public get queueArn(): string {
    return this._queue.queueArn;
  }

  public get queueName(): string {
    return this._queue.queueName;
  }

  public get queueUrl(): string {
    return this._queue.queueUrl;
  }

  public get encryptionMasterKey(): kms.IKey | undefined {
    return this._queue.encryptionMasterKey;
  }

  public addToResourcePolicy(
    statement: iam.PolicyStatement,
  ): iam.AddToResourcePolicyResult {
    return this._queue.addToResourcePolicy(statement);
  }

  public grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {
    return this._queue.grant(grantee, ...actions);
  }

  public grantConsumeMessages(grantee: iam.IGrantable): iam.Grant {
    return this._queue.grantConsumeMessages(grantee);
  }

  public grantPurge(grantee: iam.IGrantable): iam.Grant {
    return this._queue.grantPurge(grantee);
  }

  public grantSendMessages(grantee: iam.IGrantable): iam.Grant {
    return this._queue.grantSendMessages(grantee);
  }

  // Queue metrics
  public metricApproximateAgeOfOldestMessage(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricApproximateAgeOfOldestMessage(props);
  }

  public metricApproximateNumberOfMessagesDelayed(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricApproximateNumberOfMessagesDelayed(props);
  }

  public metricApproximateNumberOfMessagesNotVisible(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricApproximateNumberOfMessagesNotVisible(props);
  }

  public metricApproximateNumberOfMessagesVisible(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricApproximateNumberOfMessagesVisible(props);
  }

  public metricNumberOfEmptyReceives(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricNumberOfEmptyReceives(props);
  }

  public metricNumberOfMessagesDeleted(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricNumberOfMessagesDeleted(props);
  }

  public metricNumberOfMessagesReceived(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricNumberOfMessagesReceived(props);
  }

  public metricNumberOfMessagesSent(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricNumberOfMessagesSent(props);
  }

  public metricSentMessageSize(
    props?: cloudwatch.MetricOptions,
  ): cloudwatch.Metric {
    return this._queue.metricSentMessageSize(props);
  }
}
