import { Construct } from "constructs";
import { Duration, Tags, Stack, RemovalPolicy } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { CDK } from "./constants";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as kms from "aws-cdk-lib/aws-kms";
import { JaypieLambda, JaypieLambdaProps } from "./JaypieLambda.js";

export interface JaypieQueuedLambdaProps extends JaypieLambdaProps {
  batchSize?: number;
  fifo?: boolean;
  visibilityTimeout?: Duration | number;
}

export class JaypieQueuedLambda
  extends Construct
  implements lambda.IFunction, sqs.IQueue
{
  private readonly _queue: sqs.Queue;
  private readonly _lambdaConstruct: JaypieLambda;

  constructor(scope: Construct, id: string, props: JaypieQueuedLambdaProps) {
    super(scope, id);

    const {
      allowAllOutbound,
      allowPublicSubnet,
      architecture,
      batchSize = 1,
      code,
      datadogApiKeyArn,
      deadLetterQueue,
      deadLetterQueueEnabled,
      deadLetterTopic,
      description,
      environment = {},
      envSecrets = {},
      ephemeralStorageSize,
      fifo = true,
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
      roleTag,
      runtime = lambda.Runtime.NODEJS_22_X,
      runtimeManagementMode,
      secrets = [],
      securityGroups,
      timeout = Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
      tracing,
      vendorTag,
      visibilityTimeout = Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
      vpc,
      vpcSubnets,
    } = props;

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

    // Create Lambda with JaypieLambda
    this._lambdaConstruct = new JaypieLambda(this, "Function", {
      allowAllOutbound,
      allowPublicSubnet,
      architecture,
      code,
      datadogApiKeyArn,
      deadLetterQueue,
      deadLetterQueueEnabled,
      deadLetterTopic,
      description,
      environment: {
        ...environment,
        CDK_ENV_QUEUE_URL: this._queue.queueUrl,
      },
      envSecrets,
      ephemeralStorageSize,
      filesystem,
      handler,
      initialPolicy,
      layers,
      logRetention,
      logRetentionRole,
      logRetentionRetryOptions,
      maxEventAge,
      memorySize,
      paramsAndSecrets,
      paramsAndSecretsOptions,
      profiling,
      profilingGroup,
      provisionedConcurrentExecutions,
      reservedConcurrentExecutions,
      retryAttempts,
      roleTag,
      runtime,
      runtimeManagementMode,
      secrets,
      securityGroups,
      timeout,
      tracing,
      vendorTag,
      vpc,
      vpcSubnets,
    });

    // Set up queue and lambda integration
    this._queue.grantConsumeMessages(this._lambdaConstruct);
    this._queue.grantSendMessages(this._lambdaConstruct);
    this._lambdaConstruct.addEventSource(
      new lambdaEventSources.SqsEventSource(this._queue, {
        batchSize,
      }),
    );
  }

  // Public accessors
  public get queue(): sqs.Queue {
    return this._queue;
  }

  public get lambda(): lambda.Function {
    return this._lambdaConstruct.lambda;
  }

  // IFunction implementation
  public get functionArn(): string {
    return this._lambdaConstruct.functionArn;
  }

  public get functionName(): string {
    return this._lambdaConstruct.functionName;
  }

  public get grantPrincipal(): import("aws-cdk-lib/aws-iam").IPrincipal {
    return this._lambdaConstruct.grantPrincipal;
  }

  public get role(): import("aws-cdk-lib/aws-iam").IRole | undefined {
    return this._lambdaConstruct.role;
  }

  public get architecture(): lambda.Architecture {
    return this._lambdaConstruct.architecture;
  }

  public get connections(): import("aws-cdk-lib/aws-ec2").Connections {
    return this._lambdaConstruct.connections;
  }

  public get isBoundToVpc(): boolean {
    return this._lambdaConstruct.isBoundToVpc;
  }

  public get latestVersion(): lambda.IVersion {
    return this._lambdaConstruct.latestVersion;
  }

  public get permissionsNode(): import("constructs").Node {
    return this._lambdaConstruct.permissionsNode;
  }

  public get resourceArnsForGrantInvoke(): string[] {
    return this._lambdaConstruct.resourceArnsForGrantInvoke;
  }

  public get functionRef(): lambda.FunctionReference {
    return this._lambdaConstruct.functionRef;
  }

  public addEventSource(source: lambda.IEventSource): void {
    this._lambdaConstruct.addEventSource(source);
  }

  public addEventSourceMapping(
    id: string,
    options: lambda.EventSourceMappingOptions,
  ): lambda.EventSourceMapping {
    return this._lambdaConstruct.addEventSourceMapping(id, options);
  }

  public addFunctionUrl(
    options?: lambda.FunctionUrlOptions,
  ): lambda.FunctionUrl {
    return this._lambdaConstruct.addFunctionUrl(options);
  }

  public addPermission(id: string, permission: lambda.Permission): void {
    this._lambdaConstruct.addPermission(id, permission);
  }

  public addToRolePolicy(
    statement: import("aws-cdk-lib/aws-iam").PolicyStatement,
  ): void {
    this._lambdaConstruct.addToRolePolicy(statement);
  }

  public configureAsyncInvoke(options: lambda.EventInvokeConfigOptions): void {
    this._lambdaConstruct.configureAsyncInvoke(options);
  }

  public grantInvoke(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._lambdaConstruct.grantInvoke(grantee);
  }

  public grantInvokeCompositePrincipal(
    compositePrincipal: import("aws-cdk-lib/aws-iam").CompositePrincipal,
  ): import("aws-cdk-lib/aws-iam").Grant[] {
    return this._lambdaConstruct.grantInvokeCompositePrincipal(
      compositePrincipal,
    );
  }

  public grantInvokeUrl(
    grantee: import("aws-cdk-lib/aws-iam").IGrantable,
  ): import("aws-cdk-lib/aws-iam").Grant {
    return this._lambdaConstruct.grantInvokeUrl(grantee);
  }

  public metric(
    metricName: string,
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambdaConstruct.metric(metricName, props);
  }

  public metricDuration(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambdaConstruct.metricDuration(props);
  }

  public metricErrors(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambdaConstruct.metricErrors(props);
  }

  public metricInvocations(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambdaConstruct.metricInvocations(props);
  }

  public metricThrottles(
    props?: import("aws-cdk-lib/aws-cloudwatch").MetricOptions,
  ): import("aws-cdk-lib/aws-cloudwatch").Metric {
    return this._lambdaConstruct.metricThrottles(props);
  }

  // Additional IFunction implementation
  public grantInvokeLatestVersion(grantee: iam.IGrantable): iam.Grant {
    return this._lambdaConstruct.grantInvokeLatestVersion(grantee);
  }

  public grantInvokeVersion(
    grantee: iam.IGrantable,
    version: lambda.Version,
  ): iam.Grant {
    return this._lambdaConstruct.grantInvokeVersion(grantee, version);
  }

  public get env() {
    return {
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    };
  }

  public get stack(): Stack {
    return Stack.of(this);
  }

  public applyRemovalPolicy(policy: RemovalPolicy): void {
    this._lambdaConstruct.applyRemovalPolicy(policy);
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

  public addEnvironment(key: string, value: string): void {
    this._lambdaConstruct.addEnvironment(key, value);
  }
}
