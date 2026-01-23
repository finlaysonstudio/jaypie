import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

//
//
// Types
//

export interface SendToConnectionOptions {
  /** Connection ID to send to */
  connectionId: string;
  /** Data to send (will be JSON.stringify'd if not a string) */
  data: unknown;
  /** WebSocket API domain name */
  domainName: string;
  /** WebSocket API stage */
  stage: string;
}

export interface SendToConnectionResult {
  /** Whether the connection is still valid */
  connectionValid: boolean;
  /** Error if send failed (excluding GoneException) */
  error?: Error;
  /** Whether the send was successful */
  success: boolean;
}

//
//
// Client cache
//

const clientCache = new Map<string, ApiGatewayManagementApiClient>();

function getClient(
  domainName: string,
  stage: string,
): ApiGatewayManagementApiClient {
  const endpoint = `https://${domainName}/${stage}`;
  let client = clientCache.get(endpoint);
  if (!client) {
    client = new ApiGatewayManagementApiClient({ endpoint });
    clientCache.set(endpoint, client);
  }
  return client;
}

/**
 * Clear the client cache. Primarily for testing.
 */
export function clearClientCache(): void {
  clientCache.clear();
}

//
//
// Main
//

/**
 * Send data to a WebSocket connection.
 *
 * Handles GoneException gracefully - returns success with connectionValid: false
 * instead of throwing when a connection is stale.
 *
 * @example
 * ```typescript
 * const result = await sendToConnection({
 *   connectionId: "ABC123==",
 *   data: { type: "message", content: "Hello" },
 *   domainName: "ws.example.com",
 *   stage: "production",
 * });
 *
 * if (result.success && !result.connectionValid) {
 *   // Connection is stale, clean up from database
 *   await removeConnection(connectionId);
 * }
 * ```
 */
export async function sendToConnection(
  options: SendToConnectionOptions,
): Promise<SendToConnectionResult> {
  const { connectionId, data, domainName, stage } = options;

  const client = getClient(domainName, stage);
  const payload = typeof data === "string" ? data : JSON.stringify(data);

  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: Buffer.from(payload),
  });

  try {
    await client.send(command);
    return {
      connectionValid: true,
      success: true,
    };
  } catch (error) {
    // GoneException means the connection is stale - handle gracefully
    if (error instanceof GoneException) {
      return {
        connectionValid: false,
        success: true,
      };
    }
    return {
      connectionValid: true,
      error: error as Error,
      success: false,
    };
  }
}
