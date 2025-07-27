---
description: Auth0 authentication and authorization patterns for Jaypie Express with Mongoose
---

# Jaypie Auth0 Express Mongoose

Complete authentication and authorization patterns for Jaypie Express applications using Auth0 JWT tokens with Mongoose user management in TypeScript.

## Pattern

- TypeScript with ES modules (`"type": "module"`)
- Auth0 JWT token validation with fallback to project secrets
- User context resolution from MongoDB with aggregated permissions
- Group-based authorization with portfolio access control
- Role-based access control (RBAC) patterns
- Secure user data handling with proper error responses
- Type-safe interfaces for all authentication and authorization patterns

## Dependencies

```json
{
  "dependencies": {
    "express-oauth2-jwt-bearer": "^1.6.0",
    "@yourorg/models": "^1.0.0",
    "jaypie": "^1.1.0",
    "express": "^4.19.0",
    "mongoose": "^8.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/mongoose": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

## TypeScript Configuration

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*", "index.ts"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

## Environment Variables

```bash
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_AUDIENCE=your-api-identifier
PROJECT_SECRET=your-project-secret
PROJECT_USER_XID=system-user-id
```

## Core Authentication

**src/util/validateAuth.ts** - JWT and project secret validation
```typescript
import { getHeaderFrom, HTTP, UnauthorizedError } from "jaypie";
import { auth } from "express-oauth2-jwt-bearer";
import type { Request, Response, NextFunction } from "express";

interface AuthRequest extends Request {
  auth?: {
    payload: {
      sub: string;
      [key: string]: any;
    };
  };
}

const validateAuth = async (req: AuthRequest): Promise<boolean> => {
  const clientProjectSecret = getHeaderFrom(HTTP.HEADER.PROJECT.SECRET, req);
  
  // Project secret authentication (for service-to-service calls)
  if (clientProjectSecret && process.env.PROJECT_SECRET && 
      clientProjectSecret === process.env.PROJECT_SECRET) {
    req.auth = { payload: { sub: process.env.PROJECT_USER_XID || "system" } };
    return true;
  }

  // Auth0 JWT token validation
  const validateAuthToken = auth({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  });

  await validateAuthToken(req, {} as Response, (error?: Error) => {
    if (error) throw new UnauthorizedError();
  });
  
  return true;
};

export default validateAuth;
```

**Alternative: Promise-based validation**
```typescript
import { UnauthorizedError } from "jaypie";
import { auth } from "express-oauth2-jwt-bearer";
import type { Request, Response, NextFunction } from "express";

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
});

export default async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  return new Promise((resolve, reject) => {
    jwtCheck(req, res, (err) => {
      if (err) {
        reject(new UnauthorizedError("Invalid token"));
      } else {
        resolve();
      }
    });
  });
};
```

## User Context Resolution

**src/util/userLocal.ts** - MongoDB user lookup with permissions
```typescript
import { ConfigurationError, UnauthorizedError } from "jaypie";
import Model from "@yourorg/models";
import type { Request } from "express";

interface AuthRequest extends Request {
  auth?: {
    payload: {
      sub: string;
      [key: string]: any;
    };
  };
}

interface UserWithPortfolios {
  _id: string;
  xid: string;
  groups: string[];
  portfolios: string[];
  roles?: string[];
  [key: string]: any;
}

const userLocal = async (req: AuthRequest = {} as AuthRequest): Promise<UserWithPortfolios> => {
  if (!req?.auth?.payload?.sub) {
    throw new ConfigurationError();
  }

  const xid = req.auth.payload.sub;
  const users = await Model.User.aggregate([
    { $match: { xid, deletedAt: { $exists: false } } },
    {
      $lookup: {
        from: "groups",
        let: { groupIds: "$groups" },
        pipeline: [
          { $match: { $expr: { $in: ["$_id", "$$groupIds"] } } },
          { $project: { portfolios: 1, _id: 1 } },
        ],
        as: "groups_docs",
      },
    },
    {
      $addFields: {
        portfolios: {
          $reduce: {
            input: "$groups_docs.portfolios",
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this"] },
          },
        },
      },
    },
    { $project: { groups_docs: 0 } },
  ]);

  if (!users?.length) throw new UnauthorizedError();

  const user = new Model.User(users[0]);
  user.portfolios = users[0].portfolios.map(String);
  return user;
};

export default userLocal;
```

**Simplified user context (without aggregation)**
```typescript
import { UnauthorizedError } from "jaypie";
import Model from "@yourorg/models";
import type { Request } from "express";

interface AuthRequest extends Request {
  auth?: {
    payload: {
      sub: string;
      email?: string;
      name?: string;
      [key: string]: any;
    };
  };
}

interface UserContext {
  sub: string;
  email?: string;
  name?: string;
  groups: string[];
  portfolios: string[];
  roles: string[];
}

export default async (req: AuthRequest): Promise<UserContext> => {
  const user = req.auth?.payload;
  if (!user) {
    throw new UnauthorizedError("User not authenticated");
  }
  
  // Look up user in database if needed
  const dbUser = await Model.User.findOne({ 
    xid: user.sub,
    deletedAt: { $exists: false } 
  });
  
  if (!dbUser) {
    throw new UnauthorizedError("User not found");
  }
  
  return {
    sub: user.sub,
    email: user.email,
    name: user.name,
    groups: dbUser.groups || [],
    portfolios: dbUser.portfolios || [],
    roles: dbUser.roles || [],
  };
};
```

## Authorization Patterns

**src/util/authUserHasGroups.ts** - Group membership validation
```typescript
import { ForbiddenError } from "jaypie";

interface AuthUserHasGroupsOptions {
  requireGroups?: boolean;
}

interface User {
  groups?: string[];
}

export default (user: User, options: AuthUserHasGroupsOptions = {}): boolean => {
  const { requireGroups = true } = options;
  
  if (requireGroups && (!user.groups || user.groups.length === 0)) {
    throw new ForbiddenError("User must belong to at least one group");
  }
  
  return true;
};
```

**src/util/authUserHasAllGroups.ts** - Specific group requirements
```typescript
import { ForbiddenError } from "jaypie";

interface AuthUserHasAllGroupsOptions {
  groupUuids: string[];
}

interface User {
  groups?: string[];
}

export default async (user: User, { groupUuids }: AuthUserHasAllGroupsOptions): Promise<boolean> => {
  const userGroups = user.groups || [];
  const hasAllGroups = groupUuids.every(groupUuid => 
    userGroups.includes(groupUuid)
  );
  
  if (!hasAllGroups) {
    throw new ForbiddenError("User lacks required group permissions");
  }
  
  return true;
};
```

**src/util/authUserHasAnyGroups.ts** - Alternative group validation
```typescript
import { ForbiddenError } from "jaypie";

interface AuthUserHasAnyGroupsOptions {
  groupUuids: string[];
}

interface User {
  groups?: string[];
}

export default async (user: User, { groupUuids }: AuthUserHasAnyGroupsOptions): Promise<boolean> => {
  const userGroups = user.groups || [];
  const hasAnyGroup = groupUuids.some(groupUuid => 
    userGroups.includes(groupUuid)
  );
  
  if (!hasAnyGroup) {
    throw new ForbiddenError("User lacks required group permissions");
  }
  
  return true;
};
```

**src/util/authUserHasPortfolios.ts** - Portfolio access control
```typescript
import { ForbiddenError } from "jaypie";

interface User {
  portfolios?: string[];
}

export default (user: User, portfolioIds: string | string[]): boolean => {
  const portfolioIdsArray = Array.isArray(portfolioIds) ? portfolioIds : [portfolioIds];
  
  const userPortfolios = user.portfolios || [];
  const hasAccess = portfolioIdsArray.every(portfolioId => 
    userPortfolios.includes(portfolioId)
  );
  
  if (!hasAccess) {
    throw new ForbiddenError("User lacks portfolio access");
  }
  
  return true;
};
```

**src/util/authUserHasRoles.ts** - Role-based access control
```typescript
import { ForbiddenError } from "jaypie";

interface User {
  roles?: string[];
}

export default (user: User, requiredRoles: string | string[]): boolean => {
  const requiredRolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  const userRoles = user.roles || [];
  const hasRequiredRole = requiredRolesArray.some(role => 
    userRoles.includes(role)
  );
  
  if (!hasRequiredRole) {
    throw new ForbiddenError("User lacks required role permissions");
  }
  
  return true;
};
```

## System Context

**src/util/systemContextLocal.ts** - System metadata
```typescript
import type { Request } from "express";

interface SystemContext {
  timestamp: string;
  requestId: string;
  userAgent?: string;
  ip?: string;
  environment?: string;
}

export default async (req: Request): Promise<SystemContext> => {
  return {
    timestamp: new Date().toISOString(),
    requestId: req.headers["x-request-id"] as string || req.id,
    userAgent: req.headers["user-agent"],
    ip: req.ip || req.connection?.remoteAddress,
    environment: process.env.NODE_ENV,
  };
};
```

## Usage in Handler Config

**src/handler.config.ts** - Complete configuration
```typescript
import { force } from "jaypie";
import Model from "@yourorg/models";
import systemContextLocal from "./util/systemContextLocal.js";
import userLocal from "./util/userLocal.js";
import validateAuth from "./util/validateAuth.js";

interface HandlerConfigOptions {
  locals?: Record<string, any>;
  setup?: Array<() => void | Promise<void>>;
  teardown?: Array<() => void | Promise<void>>;
  validate?: Array<() => boolean | Promise<boolean>>;
}

interface HandlerConfig {
  name: string;
  locals: Record<string, any>;
  setup: Array<() => void | Promise<void>>;
  teardown: Array<() => void | Promise<void>>;
  validate: Array<() => boolean | Promise<boolean>>;
}

const handlerConfig = (
  nameOrConfig: string | (HandlerConfig & { name: string }),
  options: HandlerConfigOptions = {}
): HandlerConfig => {
  let name: string;
  let locals: Record<string, any>;
  let setup: Array<() => void | Promise<void>>;
  let teardown: Array<() => void | Promise<void>>;
  let validate: Array<() => boolean | Promise<boolean>>;

  if (typeof nameOrConfig === "object") {
    ({ name, locals = {}, setup = [], teardown = [], validate = [] } = nameOrConfig);
  } else {
    name = nameOrConfig;
    ({ locals = {}, setup = [], teardown = [], validate = [] } = options);
  }

  return {
    name,
    locals: { 
      ...force.object(locals), 
      systemContext: systemContextLocal, 
      user: userLocal 
    },
    setup: [Model.connect, ...force.array(setup)],
    teardown: [...force.array(teardown), Model.disconnect],
    validate: [validateAuth, ...force.array(validate)],
  };
};

export default handlerConfig;
```

## Route Authorization Examples

**Admin-only route**
```typescript
import { expressHandler } from "jaypie";
import handlerConfig from "../handler.config.js";
import authUserHasRoles from "../util/authUserHasRoles.js";
import type { Request } from "express";

interface AdminRouteRequest extends Request {
  locals: {
    user: {
      roles: string[];
    };
  };
}

interface AdminRouteResponse {
  message: string;
}

export default expressHandler(
  handlerConfig({
    name: "adminRoute",
    validate: (req: AdminRouteRequest) => authUserHasRoles(req.locals.user, ["admin"]),
  }),
  async (req: AdminRouteRequest): Promise<AdminRouteResponse> => {
    return { message: "Admin access granted" };
  }
);
```

**Group-specific route**
```typescript
import { expressHandler } from "jaypie";
import handlerConfig from "../handler.config.js";
import authUserHasAllGroups from "../util/authUserHasAllGroups.js";
import type { Request } from "express";

interface GroupRouteRequest extends Request {
  locals: {
    user: {
      groups: string[];
    };
  };
}

interface GroupRouteResponse {
  message: string;
}

export default expressHandler(
  handlerConfig({
    name: "groupRoute",
    validate: async (req: GroupRouteRequest) => {
      const requiredGroups = ["managers", "developers"];
      await authUserHasAllGroups(req.locals.user, { groupUuids: requiredGroups });
    },
  }),
  async (req: GroupRouteRequest): Promise<GroupRouteResponse> => {
    return { message: "Group access granted" };
  }
);
```

**Portfolio-scoped route**
```typescript
import { expressHandler } from "jaypie";
import handlerConfig from "../handler.config.js";
import authUserHasPortfolios from "../util/authUserHasPortfolios.js";
import type { Request } from "express";

interface PortfolioRouteRequest extends Request {
  params: {
    portfolioId: string;
  };
  locals: {
    user: {
      portfolios: string[];
    };
  };
}

interface PortfolioRouteResponse {
  message: string;
}

export default expressHandler(
  handlerConfig({
    name: "portfolioRoute",
    validate: (req: PortfolioRouteRequest) => {
      const portfolioId = req.params.portfolioId;
      authUserHasPortfolios(req.locals.user, portfolioId);
    },
  }),
  async (req: PortfolioRouteRequest): Promise<PortfolioRouteResponse> => {
    return { message: "Portfolio access granted" };
  }
);
```

## Testing Authentication

**Mock setup**
```js
import { expect, vi } from "vitest";

// Mock validateAuth
vi.mock("./src/util/validateAuth.js", () => ({
  default: vi.fn().mockResolvedValue(true),
}));

// Mock userLocal
vi.mock("./src/util/userLocal.js", () => ({
  default: vi.fn().mockResolvedValue({
    sub: "test-user-id",
    email: "test@example.com",
    groups: ["test-group-id"],
    portfolios: ["test-portfolio-id"],
    roles: ["user"],
  }),
}));
```

**Test authenticated route**
```typescript
import { describe, expect, it } from "vitest";
import userLocal from "../util/userLocal.js";
import authenticatedRoute from "../routes/authenticated.route.js";

describe("Authenticated Route", () => {
  it("returns data for authenticated user", async () => {
    const mockUser = {
      sub: "user123",
      groups: ["group1"],
      portfolios: ["portfolio1"],
    };
    
    userLocal.mockResolvedValue(mockUser);
    
    const mockRequest = {
      locals: { user: mockUser },
    } as any;
    
    const response = await authenticatedRoute(mockRequest);
    
    expect(response).toEqual({
      message: "Access granted",
      user: mockUser,
    });
  });
  
  it("throws when user lacks required groups", async () => {
    const mockUser = {
      sub: "user123",
      groups: [],
      portfolios: [],
    };
    
    const mockRequest = {
      locals: { user: mockUser },
    } as any;
    
    await expect(() => authenticatedRoute(mockRequest)).toThrowForbiddenError();
  });
});
```

## Security Best Practices

### Token Validation
- Always validate JWT tokens server-side
- Use proper audience and issuer validation
- Handle token expiration gracefully
- Implement token refresh patterns

### Error Handling
- Never expose sensitive user data in error messages
- Use generic error messages for authorization failures
- Log security events for monitoring
- Implement rate limiting for authentication endpoints

### User Data Protection
- Only expose necessary user data to client
- Hash/encrypt sensitive user information
- Implement proper session management
- Use secure HTTP headers

## Common Patterns

### Multi-tenant Authorization
```typescript
interface User {
  tenants?: string[];
}

const authUserHasTenantAccess = (user: User, tenantId: string): boolean => {
  const userTenants = user.tenants || [];
  if (!userTenants.includes(tenantId)) {
    throw new ForbiddenError("User lacks tenant access");
  }
  return true;
};
```

### Resource-level Permissions
```typescript
interface User {
  groups: string[];
}

interface Resource {
  groups: string[];
}

const authUserCanAccessResource = async (user: User, resourceId: string): Promise<boolean> => {
  const resource = await Model.Resource.findById(resourceId) as Resource;
  if (!resource) {
    throw new NotFoundError("Resource not found");
  }
  
  const hasAccess = resource.groups.some(group => 
    user.groups.includes(group)
  );
  
  if (!hasAccess) {
    throw new ForbiddenError("User lacks resource access");
  }
  
  return true;
};
```

### Conditional Authorization
```typescript
interface User {
  sub: string;
  roles: string[];
  groups: string[];
}

interface Resource {
  ownerId: string;
  groups: string[];
}

const authUserCanModifyResource = (user: User, resource: Resource): boolean => {
  // Resource owner can always modify
  if (resource.ownerId === user.sub) {
    return true;
  }
  
  // Admins can modify any resource
  if (user.roles.includes("admin")) {
    return true;
  }
  
  // Managers can modify resources in their groups
  if (user.roles.includes("manager")) {
    const hasGroupAccess = resource.groups.some(group => 
      user.groups.includes(group)
    );
    if (hasGroupAccess) {
      return true;
    }
  }
  
  throw new ForbiddenError("User cannot modify this resource");
};
```