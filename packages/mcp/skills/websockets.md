---
description: WebSocket API support using AWS API Gateway v2 WebSocket APIs
related: lambda, cdk, handlers, streaming
---

# WebSocket API (Planned)

Jaypie WebSocket support uses AWS API Gateway v2 WebSocket APIs for real-time bidirectional communication.

> **Status**: This feature is planned but not yet implemented.

## Overview

Three components work together:

| Component | Package | Purpose |
|-----------|---------|---------|
| `JaypieWebSocket` | `@jaypie/constructs` | CDK construct for infrastructure |
| `websocketHandler` | `@jaypie/lambda` | Lambda handler with lifecycle |
| `fabricWebSocket` | `@jaypie/fabric` | Fabric service adapter |

## CDK Setup

```typescript
import { JaypieWebSocket, JaypieWebSocketTable } from "@jaypie/constructs";

// WebSocket API with custom domain
const ws = new JaypieWebSocket(this, "Chat", {
  host: "ws.example.com",
  connect: connectLambda,
  disconnect: disconnectLambda,
  default: messageLambda,
  routes: {
    sendMessage: sendMessageLambda,
  },
});

// Optional: Connection storage
const connectionTable = new JaypieWebSocketTable(this, "Connections");
connectionTable.grantReadWriteData(connectLambda);
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `host` | `string \| HostConfig` | Custom domain (e.g., ws.example.com) |
| `certificate` | `boolean \| ICertificate` | SSL certificate |
| `connect` | `IFunction` | Handler for `$connect` route |
| `disconnect` | `IFunction` | Handler for `$disconnect` route |
| `default` | `IFunction` | Handler for `$default` route |
| `routes` | `Record<string, IFunction>` | Named message routes |
| `handler` | `IFunction` | Single handler for all routes |

## Lambda Handler

```typescript
import { websocketHandler } from "@jaypie/lambda";

// Single handler for all events
export const handler = websocketHandler(async (event, context) => {
  const { routeKey, connectionId, body } = context;

  switch (routeKey) {
    case "$connect":
      const token = context.queryStringParameters?.token;
      if (!await validateToken(token)) {
        return { statusCode: 401 };
      }
      await storeConnection(connectionId);
      return { statusCode: 200 };

    case "$disconnect":
      await removeConnection(connectionId);
      return { statusCode: 200 };

    default:
      const message = JSON.parse(body);
      await context.send({ received: true });
      return { statusCode: 200 };
  }
}, {
  name: "chat",
  secrets: ["MONGODB_URI"],
});
```

### Separate Handlers

```typescript
export const connect = websocketHandler(async (event, context) => {
  await storeConnection(context.connectionId);
  return { statusCode: 200 };
});

export const message = websocketHandler(async (event, context) => {
  // Send to this connection
  await context.send({ received: true });

  // Broadcast to multiple connections
  const connections = await getConnections();
  await context.broadcast(connections, { text: "Hello all" });

  return { statusCode: 200 };
});
```

## WebSocket Context

```typescript
interface WebSocketContext {
  routeKey: "$connect" | "$disconnect" | "$default" | string;
  connectionId: string;
  domainName: string;
  stage: string;
  body: string | null;
  queryStringParameters: Record<string, string>;

  // Helper methods
  send: (data: unknown) => Promise<void>;
  broadcast: (connectionIds: string[], data: unknown) => Promise<void>;
}
```

## Connection Table

```typescript
const table = new JaypieWebSocketTable(this, "Connections", {
  ttl: Duration.hours(24),  // Auto-expire stale connections
});

// Table schema:
// - Partition key: connectionId (String)
// - TTL attribute: expiresAt
// - Optional GSI: userId-index
```

## Authorization

WebSocket auth uses query string tokens on `$connect`:

```typescript
// Client connects with token
const ws = new WebSocket("wss://ws.example.com?token=xxx");

// Handler validates on connect
export const connect = websocketHandler(async (event, context) => {
  const token = context.queryStringParameters?.token;
  if (!token || !await validateToken(token)) {
    return { statusCode: 401 };  // Rejects connection
  }
  return { statusCode: 200 };  // Accepts connection
});
```

## Fabric Integration

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricWebSocket } from "@jaypie/fabric";

const chatService = fabricService({
  alias: "chat",
  input: {
    action: { type: String, validate: ["join", "message"] },
    room: { type: String },
    content: { type: String, required: false },
  },
  service: async (input, context) => {
    // context.connectionId available
    // context.sendMessage() wired to WebSocket send
  },
});

export const handler = fabricWebSocket(chatService, {
  secrets: ["MONGODB_URI"],
});
```

## Client Usage

```javascript
// Browser
const ws = new WebSocket("wss://ws.example.com?token=mytoken");

ws.onopen = () => {
  ws.send(JSON.stringify({ action: "join", room: "general" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

## Testing

```bash
# Test with wscat
wscat -c "wss://ws.dev.example.com?token=xxx"
> {"action": "ping"}
< {"action": "pong"}
```
