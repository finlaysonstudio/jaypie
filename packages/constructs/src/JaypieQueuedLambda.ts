import { Construct } from "constructs";
import { CfnOutput, Duration, Tags, Stack, RemovalPolicy } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { CDK } from "@jaypie/cdk";
import * as iam from "aws-cdk-lib/aws-iam";

const DEQUEUEING_MAXIMUM_CONCURRENT_EXECUTIONS = 1;

export interface JaypieQueuedLambdaProps {
  code: lambda.Code;
  environment?: { [key: string]: string };
  handler: string;
  memorySize?: number;
  role?: string;
  timeout?: Duration;
}

export class JaypieQueuedLambda extends Construct implements lambda.IFunction {
  private readonly _queue: sqs.Queue;
  private readonly _lambda: lambda.Function;

  constructor(scope: Construct, id: string, props: JaypieQueuedLambdaProps) {
    super(scope, id);

    const {
      code,
      environment = {},
      handler = "index.handler",
      memorySize = CDK.LAMBDA.MEMORY_SIZE,
      role,
      timeout = Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
    } = props;

    // Create SQS Queue
    this._queue = new sqs.Queue(this, "Queue", {
      fifo: true,
      visibilityTimeout: Duration.seconds(CDK.DURATION.LAMBDA_WORKER),
    });
    if (role) {
      Tags.of(this._queue).add(CDK.TAG.ROLE, role);
    }

    // Create Lambda Function
    this._lambda = new lambda.Function(this, "Function", {
      code,
      environment: {
        ...environment,
        APP_JOB_QUEUE_URL: this._queue.queueUrl,
      },
      handler,
      logRetention: CDK.LAMBDA.LOG_RETENTION,
      memorySize,
      reservedConcurrentExecutions: DEQUEUEING_MAXIMUM_CONCURRENT_EXECUTIONS,
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout,
    });
    this._queue.grantConsumeMessages(this._lambda);
    if (role) {
      Tags.of(this._lambda).add(CDK.TAG.ROLE, role);
    }

    // Add outputs
    new CfnOutput(this, "QueueUrl", {
      value: this._queue.queueUrl,
    });
    new CfnOutput(this, "QueueArn", {
      value: this._queue.queueArn,
    });
    new CfnOutput(this, "LambdaArn", {
      value: this._lambda.functionArn,
    });
  }

  // Public accessors
  public get queue(): sqs.Queue {
    return this._queue;
  }

  public get lambda(): lambda.Function {
    return this._lambda;
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
  }
}
