---
description: Service layer patterns and architecture
---

# Service Layer Patterns

Organizing business logic in Jaypie applications.

## Service Structure

Keep business logic in service modules:

```
src/
├── handlers/         # Lambda/Express handlers
├── services/         # Business logic
│   ├── user.ts
│   └── order.ts
├── models/           # Data models
└── utils/            # Utilities
```

## Basic Service Pattern

```typescript
// services/user.ts
import { log, NotFoundError, BadRequestError } from "jaypie";
import { User } from "../models/user.js";

export async function getUser(userId: string) {
  log.debug("Getting user", { userId });

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError(`User ${userId} not found`);
  }

  return user;
}

export async function createUser(input: UserCreateInput) {
  log.info("Creating user", { email: input.email });

  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new BadRequestError("Email already registered");
  }

  return User.create(input);
}
```

## Handler Integration

Handlers call services:

```typescript
// handlers/user.ts
import { lambdaHandler } from "@jaypie/lambda";
import { getUser, createUser } from "../services/user.js";

export const getUserHandler = lambdaHandler(async (event) => {
  const { userId } = event.pathParameters;
  return getUser(userId);
});

export const createUserHandler = lambdaHandler(async (event) => {
  const input = JSON.parse(event.body);
  return createUser(input);
});
```

## Service Dependencies

Inject dependencies for testability:

```typescript
// services/notification.ts
import { log } from "jaypie";

export interface NotificationService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendSms(to: string, message: string): Promise<void>;
}

export function createNotificationService(
  emailClient: EmailClient,
  smsClient: SmsClient
): NotificationService {
  return {
    async sendEmail(to, subject, body) {
      log.info("Sending email", { to, subject });
      await emailClient.send({ to, subject, body });
    },
    async sendSms(to, message) {
      log.info("Sending SMS", { to });
      await smsClient.send({ to, message });
    },
  };
}
```

## Transaction Patterns

For operations that must succeed together:

```typescript
import mongoose from "mongoose";

export async function transferFunds(fromId: string, toId: string, amount: number) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const from = await Account.findById(fromId).session(session);
    const to = await Account.findById(toId).session(session);

    if (from.balance < amount) {
      throw new BadRequestError("Insufficient funds");
    }

    from.balance -= amount;
    to.balance += amount;

    await from.save();
    await to.save();

    await session.commitTransaction();

    log.info("Transfer completed", { fromId, toId, amount });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

## Service Testing

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUser } from "./user.js";
import { User } from "../models/user.js";

vi.mock("../models/user.js");

describe("getUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user when found", async () => {
    const mockUser = { id: "123", name: "John" };
    vi.mocked(User.findById).mockResolvedValue(mockUser);

    const result = await getUser("123");

    expect(result).toEqual(mockUser);
    expect(User.findById).toHaveBeenCalledWith("123");
  });

  it("throws NotFoundError when missing", async () => {
    vi.mocked(User.findById).mockResolvedValue(null);

    await expect(getUser("123")).rejects.toThrow(NotFoundError);
  });
});
```

## See Also

- `skill("fabric")` - Fabric services
- `skill("models")` - Data models
- `skill("tests")` - Testing services
