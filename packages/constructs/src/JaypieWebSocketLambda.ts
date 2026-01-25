import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";

import { CDK } from "./constants";
import { JaypieLambda, JaypieLambdaProps } from "./JaypieLambda.js";

/**
 * JaypieWebSocketLambda - A Lambda function optimized for WebSocket handlers.
 *
 * Provides sensible defaults for WebSocket event handling:
 * - 30 second timeout (same as API handlers)
 * - API role tag
 *
 * @example
 * ```typescript
 * const handler = new JaypieWebSocketLambda(this, "ChatHandler", {
 *   code: "dist/handlers",
 *   handler: "chat.handler",
 *   secrets: ["MONGODB_URI"],
 * });
 *
 * new JaypieWebSocket(this, "Chat", {
 *   host: "ws.example.com",
 *   handler,
 * });
 * ```
 */
export class JaypieWebSocketLambda extends JaypieLambda {
  constructor(scope: Construct, id: string, props: JaypieLambdaProps) {
    super(scope, id, {
      roleTag: CDK.ROLE.API,
      timeout: Duration.seconds(CDK.DURATION.EXPRESS_API),
      ...props,
    });
  }
}
