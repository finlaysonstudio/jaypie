---
description: Legacy libraries and deprecated patterns
related: dynamodb, fabric, mocks
---

# Legacy Patterns

Deprecated libraries and patterns that may exist in older Jaypie projects.

## @jaypie/core (Deprecated)

Migrated to `@jaypie/kit`. Update imports:

```typescript
// Old
import { someUtil } from "@jaypie/core";

// New
import { someUtil } from "@jaypie/kit";
```

## @jaypie/mongoose (Legacy)

MongoDB/Mongoose integration. Consider DynamoDB for new projects.

### Connection

```typescript
import { connectMongoose } from "@jaypie/mongoose";

export const handler = async (event) => {
  await connectMongoose();
  // Connection cached for Lambda warm starts
};
```

### Models

```typescript
import mongoose, { Schema, Document } from "mongoose";

interface IUser extends Document {
  email: string;
  name: string;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true },
  name: { type: String, required: true },
}, { timestamps: true });

export const User = mongoose.model<IUser>("User", userSchema);
```

### Mocking

```typescript
vi.mock("@jaypie/mongoose", async () => {
  const { mockMongoose } = await import("@jaypie/testkit");
  return mockMongoose(vi);
});
```

## Migration Guides

### Mongoose to DynamoDB

1. Define DynamoDB item types (see `skill("dynamodb")`)
2. Update data access patterns for single-table design
3. Replace Mongoose queries with DynamoDB operations
4. Update tests to mock DynamoDB instead of Mongoose

### Core to Kit

Direct replacement - same exports, new package name:

```bash
npm uninstall @jaypie/core
npm install @jaypie/kit
```

Update imports throughout codebase.

## When to Keep Legacy

Keep legacy patterns when:
- Existing production system is stable
- Migration cost outweighs benefits
- Team expertise is in legacy stack
- Database has significant existing data

Migrate when:
- Starting new features
- Performance issues arise
- Scaling requirements change
- Simplifying architecture

