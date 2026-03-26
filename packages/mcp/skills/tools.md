---
description: Writing LLM tools with Toolkit, Fabric services, and best practices
related: fabric, llm, mcp, services
---

# Writing Tools

Define tools for LLM agents using `@jaypie/llm` Toolkit or Fabric services.

## Toolkit Tool Definition

```typescript
import { Toolkit } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "get_order",
    description: "Look up an order by ID",
    type: "function",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order ID" },
      },
      required: ["orderId"],
    },
    call: async ({ orderId }) => {
      return getOrder(orderId);
    },
  },
]);
```

## Fabric Service as Tool

Define once, use as LLM tool, MCP tool, Lambda handler, or CLI command:

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricLlmTool } from "@jaypie/fabric";
import { Toolkit } from "@jaypie/llm";

const orderService = fabricService({
  alias: "get_order",
  description: "Look up an order by ID",
  input: {
    orderId: {
      type: String,
      required: true,
      description: "Order ID to look up",
    },
  },
  service: async ({ orderId }) => {
    return getOrder(orderId);
  },
});

// As LLM tool
const toolkit = new Toolkit([fabricLlmTool(orderService)]);

// As MCP tool
fabricMcp({ service: orderService, server });
```

## Service-Backed Tools

Keep business logic in services, tools as thin wrappers:

```typescript
// services/order.ts
import { log, NotFoundError } from "jaypie";
import { Order } from "../models/order.js";

export async function getOrder(orderId: string) {
  log.debug("Looking up order", { orderId });
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`Order ${orderId} not found`);
  }
  return order;
}

export async function listOrders({ status, limit = 10 }: {
  status?: string;
  limit?: number;
} = {}) {
  log.debug("Listing orders", { status, limit });
  return Order.find({ ...(status && { status }) }, { limit });
}
```

```typescript
// tools/order.ts
import { fabricService } from "@jaypie/fabric";
import { getOrder, listOrders } from "../services/order.js";

export const getOrderService = fabricService({
  alias: "get_order",
  description: "Look up an order by ID",
  input: {
    orderId: { type: String, required: true, description: "Order ID" },
  },
  service: async ({ orderId }) => getOrder(orderId),
});

export const listOrdersService = fabricService({
  alias: "list_orders",
  description: "List orders, optionally filtered by status",
  input: {
    status: { type: String, required: false, description: "Filter by status" },
    limit: { type: Number, required: false, description: "Max results (default 10)" },
  },
  service: async ({ status, limit }) => listOrders({ status, limit }),
});
```

## Wiring Tools to LLM

```typescript
import Llm, { Toolkit } from "@jaypie/llm";
import { fabricLlmTool } from "@jaypie/fabric";
import { getOrderService, listOrdersService } from "./tools/order.js";

const toolkit = new Toolkit([
  fabricLlmTool(getOrderService),
  fabricLlmTool(listOrdersService),
]);

const response = await Llm.operate("Find all pending orders", {
  model: "claude-sonnet-4",
  tools: toolkit,
  turns: 3,
});
```

## Built-in Tools

```typescript
import Llm, { tools, JaypieToolkit } from "@jaypie/llm";

// Individual built-in tools: random, roll, time, weather
const response = await Llm.operate("Roll 2d6", {
  model: "gpt-5.1",
  tools,
});

// Or use the pre-configured toolkit
const toolkit = new JaypieToolkit();
```

## Explain Mode

Require the LLM to state its reasoning before each tool call:

```typescript
const toolkit = new Toolkit([myTool], { explain: true });

// Or per-call
const response = await Llm.operate("What's the weather?", {
  model: "gpt-5.1",
  tools: myTools,
  explain: true,
});
```

The `__Explanation` parameter is stripped before the tool executes.

## Input Types

Fabric services validate inputs automatically:

```typescript
input: {
  name: { type: String, required: true, description: "User name" },
  count: { type: Number, required: false, description: "Result limit" },
  status: {
    type: ["active", "inactive"] as const,
    required: false,
    description: "Filter by status",
  },
}
```

## Best Practices

1. **Service layer first** -- business logic in services, tools are thin adapters
2. **One tool, one action** -- each tool does one thing
3. **Descriptive names** -- use `noun_verb` format (`order_get`, `user_list`)
4. **Clear descriptions** -- LLMs choose tools based on description text
5. **Document parameters** -- every input needs a description
6. **Return JSON-serializable data** -- tools return data, not formatted text
7. **Use Jaypie errors** -- `NotFoundError`, `BadRequestError` for clear failure signals
8. **Set turns > 1** -- multi-tool workflows need room to loop

## See Also

- **`skill("fabric")`** -- Fabric service pattern and adapters
- **`skill("llm")`** -- Full `@jaypie/llm` reference
- **`skill("services")`** -- Service layer architecture
- **`skill("mcp")`** -- Jaypie MCP server tools
