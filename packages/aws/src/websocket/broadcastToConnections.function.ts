import {
  sendToConnection,
  SendToConnectionResult,
} from "./sendToConnection.function.js";

//
//
// Types
//

export interface BroadcastOptions {
  /** Connection IDs to send to */
  connectionIds: string[];
  /** Data to send (will be JSON.stringify'd if not a string) */
  data: unknown;
  /** WebSocket API domain name */
  domainName: string;
  /** WebSocket API stage */
  stage: string;
}

export interface BroadcastResult {
  /** Results for each connection */
  results: Map<string, SendToConnectionResult>;
  /** Connection IDs that are no longer valid */
  staleConnections: string[];
  /** Total number of successful sends */
  successCount: number;
}

//
//
// Main
//

/**
 * Broadcast data to multiple WebSocket connections.
 *
 * Uses Promise.allSettled to send to all connections concurrently,
 * collecting results including which connections are stale.
 *
 * @example
 * ```typescript
 * const result = await broadcastToConnections({
 *   connectionIds: ["ABC123==", "DEF456==", "GHI789=="],
 *   data: { type: "broadcast", message: "Hello everyone" },
 *   domainName: "ws.example.com",
 *   stage: "production",
 * });
 *
 * console.log(`Sent to ${result.successCount} connections`);
 *
 * // Clean up stale connections
 * for (const staleId of result.staleConnections) {
 *   await removeConnection(staleId);
 * }
 * ```
 */
export async function broadcastToConnections(
  options: BroadcastOptions,
): Promise<BroadcastResult> {
  const { connectionIds, data, domainName, stage } = options;

  const results = new Map<string, SendToConnectionResult>();
  const staleConnections: string[] = [];
  let successCount = 0;

  // Send to all connections concurrently
  const promises = connectionIds.map(async (connectionId) => {
    const result = await sendToConnection({
      connectionId,
      data,
      domainName,
      stage,
    });
    results.set(connectionId, result);
    if (result.success) {
      successCount++;
      if (!result.connectionValid) {
        staleConnections.push(connectionId);
      }
    }
    return result;
  });

  await Promise.allSettled(promises);

  return {
    results,
    staleConnections,
    successCount,
  };
}
