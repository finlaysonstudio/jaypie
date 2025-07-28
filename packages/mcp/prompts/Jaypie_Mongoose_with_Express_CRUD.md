---
description: MongoDB/Mongoose integration with Jaypie Express patterns
globs: packages/express/**
---

# Jaypie Mongoose with Express CRUD

MongoDB/Mongoose integration patterns for Jaypie Express applications with full CRUD operations, authentication, and relationship management using TypeScript.

## Pattern

- TypeScript with ES modules (`"type": "module"`)
- Model package with MongoDB/Mongoose connections
- Handler configuration with connection lifecycle
- Authentication/authorization with user context
- JSON:API formatting for consistent responses
- Relationship management with foreign keys
- Type-safe interfaces for all data models

## Dependencies

```json
{
  "dependencies": {
    "@yourorg/models": "^1.0.0",
    "mongoose": "^8.0.0",
    "jaypie": "^1.1.0",
    "express": "^4.19.0",
    "express-oauth2-jwt-bearer": "^1.6.0",
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1"
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

## Handler Configuration

**src/handler.config.ts** - Database lifecycle management
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
    locals: { ...force.object(locals), systemContext: systemContextLocal, user: userLocal },
    setup: [Model.connect, ...force.array(setup)],
    teardown: [...force.array(teardown), Model.disconnect],
    validate: [validateAuth, ...force.array(validate)],
  };
};

export default handlerConfig;
```

## Authentication & Authorization

**src/util/validateAuth.ts** - JWT validation
```typescript
import { UnauthorizedError } from "jaypie";
import { auth } from "express-oauth2-jwt-bearer";
import type { Request, Response, NextFunction } from "express";

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
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

**src/util/userLocal.ts** - User context extraction
```typescript
import { UnauthorizedError } from "jaypie";
import type { Request } from "express";

interface UserContext {
  sub: string;
  email: string;
  groups: string[];
  portfolios: string[];
}

export default async (req: Request): Promise<UserContext> => {
  const user = req.auth?.payload;
  if (!user) {
    throw new UnauthorizedError("User not authenticated");
  }
  
  return {
    sub: user.sub,
    email: user.email,
    groups: user.groups || [],
    portfolios: user.portfolios || [],
  };
};
```

**src/util/authUserHasGroups.ts** - Group authorization
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

**src/util/authUserHasAllGroups.ts** - Specific group validation
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

## Database Operations

### Model Connection
```typescript
// Connect to MongoDB
await Model.connect();

// Disconnect from MongoDB
await Model.disconnect();
```

### CRUD Operations

**Create with relationships**
```typescript
import Model from "@yourorg/models";

const Resource = Model.Resource;
const Group = Model.Group;

await Resource.createWithRelationships({
  foreignKey: "resources",
  models: { groups: Group },
  uuid: resourceId,
  values: {
    name: "Resource Name",
    description: "Resource Description",
    groups: ["group-uuid-1", "group-uuid-2"]
  },
});
```

**Read operations**
```typescript
// Find by UUID
const resource = await Model.Resource.oneByUuid(resourceId);

// Find by query
const resources = await Model.Resource.find({
  name: { $regex: "search-term", $options: "i" }
});

// Find with relationships
const resource = await Model.Resource.oneByUuid(resourceId, {
  populate: ["groups", "portfolios"]
});
```

**Update with relationships**
```typescript
await Model.Resource.updateWithRelationships({
  uuid: resourceId,
  values: {
    name: "Updated Name",
    groups: ["new-group-uuid"]
  },
});
```

**Delete operations**
```typescript
// Soft delete
await Model.Resource.deleteByUuid(resourceId);

// Hard delete
await Model.Resource.destroyByUuid(resourceId);
```

## CRUD Route Handlers

**src/routes/resource/resourceCreate.route.ts**
```typescript
import { cloneDeep, expressHandler, uuid } from "jaypie";
import Model from "@yourorg/models";
import handlerConfig from "../../handler.config.js";
import authUserHasGroups from "../../util/authUserHasGroups.js";
import formatMongoToJsonApi from "../../util/formatMongoToJsonApi.js";
import jsonApiValidator from "../../util/jsonApiValidator.js";
import resourceJsonSchema from "./resourceJson.schema.js";
import type { Request } from "express";

interface ResourceCreateRequest extends Request {
  body: {
    data: {
      attributes: {
        name: string;
        description?: string;
        groups?: string[];
        portfolios?: string[];
      };
    };
  };
  locals: {
    user: {
      groups: string[];
    };
  };
}

interface ResourceCreateResponse {
  data: {
    type: string;
    id: string;
    attributes: Record<string, any>;
  };
}

export default expressHandler(
  handlerConfig({
    name: "resourceCreate",
    validate: jsonApiValidator(resourceJsonSchema),
  }),
  async (req: ResourceCreateRequest): Promise<ResourceCreateResponse> => {
    const { user } = req.locals;

    authUserHasGroups(user);

    const Resource = Model.Resource;
    const Group = Model.Group;
    const id = uuid();

    const { groups = [] } = req.body.data.attributes;
    if (!groups.length) {
      groups.push(...(await Group.idsToUuids(user.groups)));
    }

    const createdResource = Object.assign(
      { name: "Default Resource" },
      cloneDeep(req.body.data.attributes),
      { groups }
    );

    await Resource.createWithRelationships({
      foreignKey: "resources",
      models: { groups: Group },
      uuid: id,
      values: createdResource,
    });

    const returnResource = cloneDeep(createdResource);
    returnResource.uuid = id;
    return formatMongoToJsonApi(returnResource, resourceJsonSchema);
  }
);
```

**src/routes/resource/resourceRead.route.ts**
```typescript
import { expressHandler, NotFoundError } from "jaypie";
import Model from "@yourorg/models";
import handlerConfig from "../../handler.config.js";
import authUserHasGroups from "../../util/authUserHasGroups.js";
import formatMongoToJsonApi from "../../util/formatMongoToJsonApi.js";
import resourceJsonSchema from "./resourceJson.schema.js";
import type { Request } from "express";

interface ResourceReadRequest extends Request {
  params: {
    id: string;
  };
  locals: {
    user: {
      groups: string[];
    };
  };
}

interface ResourceReadResponse {
  data: {
    type: string;
    id: string;
    attributes: Record<string, any>;
  };
}

export default expressHandler(
  handlerConfig("resourceRead"),
  async (req: ResourceReadRequest): Promise<ResourceReadResponse> => {
    const { user } = req.locals;
    const { id } = req.params;

    authUserHasGroups(user);

    const Resource = Model.Resource;
    const resource = await Resource.oneByUuid(id);

    if (!resource) {
      throw new NotFoundError("Resource not found");
    }

    // Check user has access to resource groups
    const hasAccess = resource.groups.some((group: string) => 
      user.groups.includes(group)
    );

    if (!hasAccess) {
      throw new NotFoundError("Resource not found");
    }

    return formatMongoToJsonApi(resource, resourceJsonSchema);
  }
);
```

**src/routes/resource/resourceUpdate.route.ts**
```typescript
import { cloneDeep, expressHandler, NotFoundError } from "jaypie";
import Model from "@yourorg/models";
import handlerConfig from "../../handler.config.js";
import authUserHasGroups from "../../util/authUserHasGroups.js";
import formatMongoToJsonApi from "../../util/formatMongoToJsonApi.js";
import jsonApiValidator from "../../util/jsonApiValidator.js";
import resourceJsonSchema from "./resourceJson.schema.js";
import type { Request } from "express";

interface ResourceUpdateRequest extends Request {
  body: {
    data: {
      attributes: Record<string, any>;
    };
  };
  params: {
    id: string;
  };
  locals: {
    user: {
      groups: string[];
    };
  };
}

interface ResourceUpdateResponse {
  data: {
    type: string;
    id: string;
    attributes: Record<string, any>;
  };
}

export default expressHandler(
  handlerConfig({
    name: "resourceUpdate",
    validate: jsonApiValidator(resourceJsonSchema),
  }),
  async (req: ResourceUpdateRequest): Promise<ResourceUpdateResponse> => {
    const { user } = req.locals;
    const { id } = req.params;

    authUserHasGroups(user);

    const Resource = Model.Resource;
    const existingResource = await Resource.oneByUuid(id);

    if (!existingResource) {
      throw new NotFoundError("Resource not found");
    }

    const updateData = cloneDeep(req.body.data.attributes);
    
    await Resource.updateWithRelationships({
      uuid: id,
      values: updateData,
    });

    const updatedResource = await Resource.oneByUuid(id);
    return formatMongoToJsonApi(updatedResource, resourceJsonSchema);
  }
);
```

**src/routes/resource/resourceDelete.route.ts**
```typescript
import { expressHandler, NotFoundError } from "jaypie";
import Model from "@yourorg/models";
import handlerConfig from "../../handler.config.js";
import authUserHasGroups from "../../util/authUserHasGroups.js";
import type { Request } from "express";

interface ResourceDeleteRequest extends Request {
  params: {
    id: string;
  };
  locals: {
    user: {
      groups: string[];
    };
  };
}

export default expressHandler(
  handlerConfig("resourceDelete"),
  async (req: ResourceDeleteRequest): Promise<boolean> => {
    const { user } = req.locals;
    const { id } = req.params;

    authUserHasGroups(user);

    const Resource = Model.Resource;
    const resource = await Resource.oneByUuid(id);

    if (!resource) {
      throw new NotFoundError("Resource not found");
    }

    await Resource.deleteByUuid(id);
    return true; // 201 Created
  }
);
```

**src/routes/resource/resourceIndex.route.ts**
```typescript
import { expressHandler } from "jaypie";
import Model from "@yourorg/models";
import handlerConfig from "../../handler.config.js";
import authUserHasGroups from "../../util/authUserHasGroups.js";
import formatMongoToJsonApi from "../../util/formatMongoToJsonApi.js";
import resourceJsonSchema from "./resourceJson.schema.js";
import type { Request } from "express";

interface ResourceIndexRequest extends Request {
  query: {
    limit?: string;
    offset?: string;
    search?: string;
  };
  locals: {
    user: {
      groups: string[];
    };
  };
}

interface ResourceIndexResponse {
  data: Array<{
    type: string;
    id: string;
    attributes: Record<string, any>;
  }>;
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export default expressHandler(
  handlerConfig("resourceIndex"),
  async (req: ResourceIndexRequest): Promise<ResourceIndexResponse> => {
    const { user } = req.locals;
    const { limit = "20", offset = "0", search } = req.query;

    authUserHasGroups(user);

    const Resource = Model.Resource;
    let query: Record<string, any> = {
      groups: { $in: user.groups }
    };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const resources = await Resource.find(query)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .sort({ createdAt: -1 });

    const total = await Resource.countDocuments(query);

    return {
      data: resources.map(resource => 
        formatMongoToJsonApi(resource, resourceJsonSchema)
      ),
      meta: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    };
  }
);
```

## JSON Schema & Validation

**src/routes/resource/resourceJson.schema.ts**
```typescript
interface ResourceJsonSchema {
  type: string;
  properties: {
    data: {
      type: string;
      properties: {
        type: {
          type: string;
          enum: string[];
        };
        attributes: {
          type: string;
          properties: {
            name: {
              type: string;
              minLength: number;
              maxLength: number;
            };
            description: {
              type: string;
              maxLength: number;
            };
            groups: {
              type: string;
              items: {
                type: string;
                format: string;
              };
            };
            portfolios: {
              type: string;
              items: {
                type: string;
                format: string;
              };
            };
          };
          required: string[];
          additionalProperties: boolean;
        };
      };
      required: string[];
      additionalProperties: boolean;
    };
  };
  required: string[];
  additionalProperties: boolean;
}

const resourceJsonSchema: ResourceJsonSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["resource"],
        },
        attributes: {
          type: "object",
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 255,
            },
            description: {
              type: "string",
              maxLength: 1000,
            },
            groups: {
              type: "array",
              items: {
                type: "string",
                format: "uuid",
              },
            },
            portfolios: {
              type: "array",
              items: {
                type: "string",
                format: "uuid",
              },
            },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      required: ["type", "attributes"],
      additionalProperties: false,
    },
  },
  required: ["data"],
  additionalProperties: false,
};

export default resourceJsonSchema;
```

## Utility Functions

**src/util/formatMongoToJsonApi.ts**
```typescript
interface MongoDoc {
  toObject?: () => Record<string, any>;
  [key: string]: any;
}

interface JsonApiSchema {
  properties: {
    data: {
      properties: {
        type: {
          enum: string[];
        };
      };
    };
  };
}

interface JsonApiResponse {
  data: {
    type: string;
    id: string;
    attributes: Record<string, any>;
  };
}

export default (mongoDoc: MongoDoc, schema: JsonApiSchema): JsonApiResponse => {
  const { _id, __v, ...attributes } = mongoDoc.toObject ? mongoDoc.toObject() : mongoDoc;
  
  return {
    data: {
      type: schema.properties.data.properties.type.enum[0],
      id: attributes.uuid,
      attributes: {
        ...attributes,
        id: undefined,
        uuid: undefined,
      },
    },
  };
};
```

**src/util/jsonApiValidator.ts**
```typescript
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { BadRequestError } from "jaypie";
import type { Request } from "express";

interface ValidationError {
  field: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export default (schema: object) => {
  const validate = ajv.compile(schema);
  
  return (req: Request): boolean => {
    const valid = validate(req.body);
    
    if (!valid) {
      const errors: ValidationError[] = validate.errors?.map(error => ({
        field: error.instancePath,
        message: error.message || "Validation error",
      })) || [];
      
      throw new BadRequestError("Validation failed", { errors });
    }
    
    return true;
  };
};
```

## Testing Setup

**vitest.config.ts**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

**vitest.setup.ts** - MongoDB mocking
```typescript
import Model from "@yourorg/models";
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect, vi } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);

vi.mock("@yourorg/models");
vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));
vi.mock("./src/util/userLocal.js");
vi.mock("./src/util/validateAuth.js");

// Mock Model methods
Model.connect = vi.fn();
Model.disconnect = vi.fn();

Model.mock.Resource.oneByUuid.mockResolvedValue({
  _id: "resource000000000000000",
  name: "Mock Resource",
  uuid: "MOCK_RESOURCE_UUID",
  groups: ["group000000000000000"],
  toObject: () => ({
    name: "Mock Resource",
    uuid: "MOCK_RESOURCE_UUID",
    groups: ["group000000000000000"],
  }),
});

Model.mock.Resource.find.mockResolvedValue([
  {
    _id: "resource000000000000001",
    name: "Mock Resource 1",
    uuid: "MOCK_RESOURCE_UUID_1",
    groups: ["group000000000000000"],
  },
]);

Model.mock.Resource.createWithRelationships.mockResolvedValue({
  _id: "resource000000000000002",
  name: "Created Resource",
  uuid: "CREATED_RESOURCE_UUID",
});

Model.mock.Group.idsToUuids.mockResolvedValue([
  "group000000000000000",
]);
```

## Test Examples

**Unit Test**
```typescript
import { uuid } from "jaypie";
import { describe, expect, it } from "vitest";
import Model from "@yourorg/models";
import resourceCreate from "../resourceCreate.route.js";

uuid.mockReturnValue("generated-uuid");

describe("Resource Create Route", () => {
  it("creates resource with relationships", async () => {
    const mockRequest = {
      body: {
        data: {
          type: "resource",
          attributes: {
            name: "Test Resource",
            groups: ["00000000-0000-0000-0000-000000000000"],
          },
        },
      },
      locals: {
        user: {
          sub: "user123",
          groups: ["00000000-0000-0000-0000-000000000000"],
        },
      },
    } as any;

    const response = await resourceCreate(mockRequest);

    expect(Model.Resource.createWithRelationships).toHaveBeenCalledWith({
      foreignKey: "resources",
      models: { groups: Model.Group },
      uuid: "generated-uuid",
      values: expect.objectContaining({
        name: "Test Resource",
        groups: ["00000000-0000-0000-0000-000000000000"],
      }),
    });

    expect(response.data.id).toBe("generated-uuid");
  });

  it("throws when user has no groups", async () => {
    const mockRequest = {
      body: {
        data: {
          type: "resource",
          attributes: { name: "Test Resource" },
        },
      },
      locals: {
        user: { sub: "user123", groups: [] },
      },
    } as any;

    await expect(() => resourceCreate(mockRequest)).toThrowForbiddenError();
  });
});
```

## Connection Management

### Environment Variables
```bash
MONGODB_URI=mongodb://localhost:27017/myapp
MONGODB_DB_NAME=myapp
```

### Model Configuration
```typescript
// @yourorg/models package structure
export default {
  connect: async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  },
  disconnect: async () => {
    await mongoose.disconnect();
  },
  Resource: ResourceModel,
  Group: GroupModel,
  Portfolio: PortfolioModel,
};
```

## Error Handling

### Database Errors
```typescript
import { InternalError, BadRequestError } from "jaypie";

try {
  await Model.Resource.createWithRelationships(data);
} catch (error: any) {
  if (error.code === 11000) {
    // Duplicate key error
    throw new BadRequestError("Resource already exists");
  }
  throw new InternalError("Database operation failed");
}
```

### Validation Errors
```typescript
// JSON Schema validation automatically throws BadRequestError
// Custom validation in routes:
if (!resourceData.name || resourceData.name.trim() === "") {
  throw new BadRequestError("Resource name is required");
}
```

## Performance Considerations

### Indexing
```typescript
// In your MongoDB models
resourceSchema.index({ uuid: 1 }, { unique: true });
resourceSchema.index({ groups: 1 });
resourceSchema.index({ name: "text" });
```

### Query Optimization
```typescript
// Use projection to limit fields
const resources = await Resource.find(query, {
  name: 1,
  uuid: 1,
  groups: 1,
  createdAt: 1,
});

// Use lean() for read-only operations
const resources = await Resource.find(query).lean();
```

### Connection Pooling
```typescript
// In Model.connect()
await mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```