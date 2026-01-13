import { Construct } from "constructs";
import { Duration, Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { CDK, LAMBDA_WEB_ADAPTER } from "./constants";
import { JaypieLambda, JaypieLambdaProps } from "./JaypieLambda.js";

export interface JaypieStreamingLambdaProps extends JaypieLambdaProps {
  /**
   * The port your application listens on.
   * @default 8000
   */
  port?: number;
  /**
   * Enable response streaming mode.
   * When true, uses RESPONSE_STREAM invoke mode.
   * When false, uses BUFFERED invoke mode.
   * @default false
   */
  streaming?: boolean;
}

/**
 * A Lambda construct that uses AWS Lambda Web Adapter for streaming support.
 * This allows running web applications (Express, Fastify, etc.) with streaming responses.
 *
 * @example
 * ```typescript
 * const streamingLambda = new JaypieStreamingLambda(this, "StreamingApi", {
 *   code: "dist/api",
 *   handler: "run.sh",
 *   streaming: true,
 * });
 *
 * // Use with JaypieDistribution
 * new JaypieDistribution(this, "Distribution", {
 *   handler: streamingLambda,
 *   invokeMode: streamingLambda.invokeMode,
 * });
 * ```
 */
export class JaypieStreamingLambda extends JaypieLambda {
  /**
   * The invoke mode for this Lambda function.
   * Use this when configuring JaypieDistribution.
   */
  public readonly invokeMode: lambda.InvokeMode;

  constructor(scope: Construct, id: string, props: JaypieStreamingLambdaProps) {
    const {
      architecture = lambda.Architecture.X86_64,
      environment: propsEnvironment,
      layers: propsLayers = [],
      port = LAMBDA_WEB_ADAPTER.DEFAULT_PORT,
      streaming = false,
      ...restProps
    } = props;

    // Determine the Lambda Web Adapter layer ARN based on architecture
    const region = Stack.of(scope).region;
    const layerArn =
      architecture === lambda.Architecture.ARM_64
        ? `arn:aws:lambda:${region}:${LAMBDA_WEB_ADAPTER.ACCOUNT}:layer:${LAMBDA_WEB_ADAPTER.LAYER.ARM64}:${LAMBDA_WEB_ADAPTER.VERSION}`
        : `arn:aws:lambda:${region}:${LAMBDA_WEB_ADAPTER.ACCOUNT}:layer:${LAMBDA_WEB_ADAPTER.LAYER.X86}:${LAMBDA_WEB_ADAPTER.VERSION}`;

    // Create the Lambda Web Adapter layer
    const webAdapterLayer = lambda.LayerVersion.fromLayerVersionArn(
      scope,
      `${id}WebAdapterLayer`,
      layerArn,
    );

    // Build environment variables with Lambda Web Adapter configuration
    const lwaInvokeMode = streaming
      ? LAMBDA_WEB_ADAPTER.INVOKE_MODE.RESPONSE_STREAM
      : LAMBDA_WEB_ADAPTER.INVOKE_MODE.BUFFERED;

    const webAdapterEnvironment: Record<string, string> = {
      AWS_LAMBDA_EXEC_WRAPPER: LAMBDA_WEB_ADAPTER.EXEC_WRAPPER,
      AWS_LWA_INVOKE_MODE: lwaInvokeMode,
      PORT: String(port),
    };

    // Merge environment variables - props environment takes precedence
    let mergedEnvironment: JaypieLambdaProps["environment"];
    if (Array.isArray(propsEnvironment)) {
      // Array syntax: prepend our object to the array
      mergedEnvironment = [webAdapterEnvironment, ...propsEnvironment];
    } else if (propsEnvironment && typeof propsEnvironment === "object") {
      // Object syntax: merge objects
      mergedEnvironment = {
        ...webAdapterEnvironment,
        ...propsEnvironment,
      };
    } else {
      mergedEnvironment = webAdapterEnvironment;
    }

    super(scope, id, {
      architecture,
      environment: mergedEnvironment,
      layers: [webAdapterLayer, ...propsLayers],
      roleTag: CDK.ROLE.API,
      timeout: Duration.seconds(CDK.DURATION.EXPRESS_API),
      ...restProps,
    });

    // Set invoke mode for use with JaypieDistribution
    this.invokeMode = streaming
      ? lambda.InvokeMode.RESPONSE_STREAM
      : lambda.InvokeMode.BUFFERED;
  }
}
