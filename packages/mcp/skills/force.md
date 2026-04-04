---
description: Type coercion utilities for safe value conversion
related: style, errors, variables
---

# Force

Coerce values to expected types without throwing. Returns sensible defaults for invalid input.

## Import

```typescript
import { force } from "@jaypie/kit";
// or
import { force } from "jaypie";
```

## Convenience Methods

### force.array(value)

Wraps non-array values in an array. Arrays pass through.

```typescript
force.array("hello");     // ["hello"]
force.array([1, 2]);      // [1, 2]
force.array(undefined);   // [undefined]
```

### force.boolean(value)

Parses boolean with string awareness. Falsy strings: `""`, `"0"`, `"f"`, `"false"`, `"n"`, `"no"` (case-insensitive).

```typescript
force.boolean("false");   // false
force.boolean("no");      // false
force.boolean("0");       // false
force.boolean("");        // false
force.boolean("yes");     // true
force.boolean("anything"); // true
force.boolean(0);         // false
force.boolean(1);         // true
force.boolean(null);      // false
```

### force.number(value)

Converts to number. Returns `0` for non-numeric input.

```typescript
force.number("42");       // 42
force.number("abc");      // 0
force.number(null);       // 0
force.number(undefined);  // 0
```

### force.positive(value)

Like `force.number` but clamps to minimum `0`.

```typescript
force.positive(-5);       // 0
force.positive("10");     // 10
force.positive("abc");    // 0
```

### force.string(value, default?)

Converts to string. Second argument is default for `undefined`.

```typescript
force.string(42);         // "42"
force.string(null);       // "null"
force.string(undefined);  // ""
force.string(undefined, "fallback"); // "fallback"
force.string({ a: 1 });  // '{"a":1}'
```

### force.object(value, key?)

Ensures object. Wraps scalars as `{ [key]: value }` (default key: `"value"`). Parses JSON strings.

```typescript
force.object({ a: 1 });         // { a: 1 }
force.object(42);                // { value: 42 }
force.object(42, "count");      // { count: 42 }
force.object('{"a":1}');        // { a: 1 }
force.object("hello");          // { value: "hello" }
```

## Advanced: force(value, type, options?)

The base function accepts a type constructor and options:

```typescript
force(value, Number, { minimum: 0, maximum: 100 });
force(value, Number, { nan: true }); // allow NaN instead of returning 0
force(value, String, "default");     // default for undefined
force(value, Object, "keyName");     // wrap key name
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `minimum` | `number` | Clamp number to minimum |
| `maximum` | `number` | Clamp number to maximum |
| `nan` | `boolean` | If `true`, return `NaN` instead of `0` for non-numeric input |
| `key` | `string` | Key name when wrapping scalar in object (default: `"value"`) |

If `minimum > maximum`, clamping is skipped.

## Testing

Mocked automatically via `@jaypie/testkit/mock` when mocking `jaypie` or `@jaypie/kit`.
