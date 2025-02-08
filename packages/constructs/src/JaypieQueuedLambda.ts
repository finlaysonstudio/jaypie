import { Construct } from "constructs";
import { CfnOutput, Duration, Tags } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { CDK } from "@jaypie/cdk";

const DEQUEUEING_MAXIMUM_CONCURRENT_EXECUTIONS = 1;

export interface JaypieQueuedLambdaProps {
  code: lambda.Code;
  environment?: { [key: string]: string };
  handler: string;
  memorySize?: number;
  role?: string;
  timeout?: Duration;
}

export class JaypieQueuedLambda extends Construct {
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
}
