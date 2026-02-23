---
description: Template string replacement with {{key}} syntax
related: llm, style, tests
---

# Placeholders

Replace `{{key}}` tokens in template strings with values from a data object. Supports nested paths and function templates.

## Import

```typescript
import { placeholders } from "@jaypie/kit";
// or
import { placeholders } from "jaypie";
```

## Signature

```typescript
function placeholders(
  template: string | (() => string),
  data?: Record<string, unknown>,
): string
```

## Syntax

- Double curly braces: `{{key}}`
- Dot notation: `{{user.name}}`
- Bracket notation: `{{items[0].city}}`
- Whitespace trimmed: `{{ name }}` resolves same as `{{name}}`
- Unmatched keys remain: `{{missing}}` passes through unchanged

## Examples

```typescript
// Simple replacement
placeholders("Hello, {{name}}!", { name: "Alice" });
// "Hello, Alice!"

// Nested paths
placeholders("Email: {{user.profile.email}}", {
  user: { profile: { email: "alice@example.com" } },
});
// "Email: alice@example.com"

// Array access
placeholders("First: {{items[0]}}", { items: ["alpha", "beta"] });
// "First: alpha"

// Function template (lazy evaluation)
placeholders(() => `Generated at {{time}}`, { time: "12:00" });
// "Generated at 12:00"

// Missing keys pass through
placeholders("{{known}} and {{unknown}}", { known: "yes" });
// "yes and {{unknown}}"
```

## LLM Integration

`@jaypie/llm` applies placeholders to `input`, `instructions`, and `system` when `data` is provided.

```typescript
import Llm from "@jaypie/llm";

const response = await Llm.operate("Summarize {{topic}}", {
  model: "claude-sonnet-4",
  data: { topic: "climate change" },
  system: "You are an expert on {{topic}}",
  instructions: "Focus on {{aspect}}",
});
```

### Placeholder Control Flags

Disable substitution per-field:

```typescript
await Llm.operate("Hello {{name}}", {
  data: { name: "Alice" },
  placeholders: {
    input: true,        // default: true
    instructions: true, // default: true
    system: false,      // skip system prompt substitution
  },
});
```

All three default to `true` when `data` is provided.

## Testing

Mocked automatically via `@jaypie/testkit/mock` when mocking `jaypie` or `@jaypie/kit`.

```typescript
vi.mock("jaypie", async () => import("@jaypie/testkit/mock"));

// The mock passes through with the same signature
import { placeholders } from "jaypie";
expect(placeholders("{{x}}", { x: "y" })).toBe("y");
```
