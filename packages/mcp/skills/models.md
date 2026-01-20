---
description: Data models and schemas
---

# Data Models

Patterns for defining data models in Jaypie applications.

## Mongoose Models

### Basic Model

```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  name: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", userSchema);
```

### Model with Methods

```typescript
interface IUserMethods {
  isAdmin(): boolean;
  fullName(): string;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>({
  // ... schema fields
});

userSchema.methods.isAdmin = function() {
  return this.role === "admin";
};

userSchema.methods.fullName = function() {
  return `${this.firstName} ${this.lastName}`;
};
```

### Model with Statics

```typescript
interface UserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
}

userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

export const User = mongoose.model<IUser, UserModel>("User", userSchema);

// Usage
const user = await User.findByEmail("john@example.com");
```

## Connection Management

Use `@jaypie/mongoose` for connection handling:

```typescript
import { connectMongoose } from "@jaypie/mongoose";

// In Lambda handler
export const handler = async (event) => {
  await connectMongoose();
  // Connection is cached for warm starts
};
```

## Validation

### Schema Validation

```typescript
const userSchema = new Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    validate: {
      validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: "Invalid email format",
    },
  },
  age: {
    type: Number,
    min: [0, "Age must be positive"],
    max: [150, "Age must be realistic"],
  },
});
```

### Custom Validators

```typescript
const orderSchema = new Schema({
  items: {
    type: [itemSchema],
    validate: {
      validator: (v: IItem[]) => v.length > 0,
      message: "Order must have at least one item",
    },
  },
});
```

## Indexes

```typescript
const userSchema = new Schema({
  email: { type: String, unique: true },
  organizationId: String,
  role: String,
});

// Compound index
userSchema.index({ organizationId: 1, role: 1 });

// Text search index
userSchema.index({ name: "text", bio: "text" });
```

## Soft Deletes

```typescript
const userSchema = new Schema({
  // ... fields
  deletedAt: { type: Date, default: null },
});

// Query only active records
userSchema.pre("find", function() {
  this.where({ deletedAt: null });
});

// Soft delete method
userSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};
```

## TypeScript Types

Export types alongside models:

```typescript
// types.ts
export interface UserCreateInput {
  email: string;
  name: string;
  role?: "user" | "admin";
}

export interface UserUpdateInput {
  name?: string;
  role?: "user" | "admin";
}

// Use in services
async function createUser(input: UserCreateInput): Promise<IUser> {
  return User.create(input);
}
```

## See Also

- `skill("dynamodb")` - DynamoDB patterns
- `skill("services")` - Service layer
- `skill("tests")` - Testing models
