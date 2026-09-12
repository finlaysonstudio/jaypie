# Jaypie MCP 🐦‍⬛

Model Context Protocol server for Jaypie.

See [jaypie.net](https://jaypie.net) for documentation.

## Usage

### CLI (stdio)

```bash
npx jaypie-mcp
```

### Streamable HTTP on Lambda (no MCP SDK)

```typescript
import express from "express";
import { createLambdaStreamHandler } from "@jaypie/express";
import { mcpHttpHandler } from "@jaypie/mcp/http";

const app = express();
app.use(express.json());
app.all("/mcp", mcpHttpHandler({ services: ["skill", "version"] }));

export const handler = createLambdaStreamHandler(app);
```

`mcpHttpHandler` answers JSON or server-sent events by `Accept` header, 202 for notifications, and 405 for GET and DELETE. Pass `suite` to serve any fabric `ServiceSuite`. Lifecycle options (`secrets`, `setup`, `validate`, ...) pass through to `expressHandler`. Requires `@jaypie/express` and `@jaypie/logger` (optional peers, included in `jaypie`).

### Filtering Tools

`createMcpServer`, `mcpExpressHandler`, and `mcpHttpHandler` accept `services`, an allowlist of tool names:

```typescript
import { createMcpServer } from "@jaypie/mcp";

const server = createMcpServer({ services: ["skill", "version"] });
```

## 📜 License

[MIT License](./LICENSE.txt). Published by Finlayson Studio.
