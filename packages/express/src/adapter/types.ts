import type { Application } from "express";

//
//
// Lambda Context Types
//

export interface LambdaContext {
  awsRequestId: string;
  callbackWaitsForEmptyEventLoop?: boolean;
  functionName?: string;
  functionVersion?: string;
  invokedFunctionArn?: string;
  logGroupName?: string;
  logStreamName?: string;
  memoryLimitInMB?: string;
  [key: string]: unknown;
}

//
//
// API Gateway REST API Event (v1 format)
//

export interface ApiGatewayV1Event {
  body?: string | null;
  headers: Record<string, string>;
  httpMethod: string;
  isBase64Encoded: boolean;
  multiValueHeaders?: Record<string, string[]>;
  multiValueQueryStringParameters?: Record<string, string[]> | null;
  path: string;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  requestContext: {
    accountId: string;
    apiId: string;
    domainName?: string;
    httpMethod: string;
    identity: {
      sourceIp: string;
      userAgent?: string;
    };
    path: string;
    protocol: string;
    requestId: string;
    requestTime?: string;
    requestTimeEpoch?: number;
    resourceId?: string;
    resourcePath?: string;
    stage: string;
  };
  resource?: string;
  stageVariables?: Record<string, string> | null;
}

//
//
// Function URL Event (v2 format)
//

export interface FunctionUrlEvent {
  body?: string;
  cookies?: string[];
  headers: Record<string, string>;
  isBase64Encoded: boolean;
  rawPath: string;
  rawQueryString: string;
  requestContext: {
    accountId: string;
    apiId: string;
    domainName: string;
    domainPrefix: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    requestId: string;
    routeKey: string;
    stage: string;
    time: string;
    timeEpoch: number;
  };
  routeKey: string;
  version: "2.0";
}

//
//
// Union type for all supported Lambda events
//

export type LambdaEvent = ApiGatewayV1Event | FunctionUrlEvent;

//
//
// Lambda Response Types
//

export interface LambdaResponse {
  body: string;
  cookies?: string[];
  headers: Record<string, string>;
  isBase64Encoded: boolean;
  statusCode: number;
}

//
//
// Response Stream Types (for awslambda global)
//

export interface ResponseStream {
  end(): void;
  write(chunk: string | Uint8Array): void;
}

export interface HttpResponseStreamMetadata {
  headers: Record<string, string>;
  statusCode: number;
}

/**
 * Global awslambda object provided by Lambda runtime.
 * This is only available when running in AWS Lambda.
 */
export interface AwsLambdaGlobal {
  HttpResponseStream: {
    from(
      stream: ResponseStream,
      metadata: HttpResponseStreamMetadata,
    ): ResponseStream;
  };
  streamifyResponse<TEvent = unknown>(
    handler: (
      event: TEvent,
      responseStream: ResponseStream,
      context: LambdaContext,
    ) => Promise<void>,
  ): (event: TEvent, context: LambdaContext) => Promise<void>;
}

//
//
// Handler Types
//

export type LambdaHandler = (
  event: LambdaEvent,
  context: LambdaContext,
) => Promise<LambdaResponse>;

export type LambdaStreamHandler = (
  event: LambdaEvent,
  context: LambdaContext,
) => Promise<void>;

export type CreateLambdaHandlerOptions = {
  /**
   * Optional name for logging and debugging
   */
  name?: string;
};

export type LambdaHandlerFactory = (
  app: Application,
  options?: CreateLambdaHandlerOptions,
) => LambdaHandler;

export type LambdaStreamHandlerFactory = (
  app: Application,
  options?: CreateLambdaHandlerOptions,
) => LambdaStreamHandler;
