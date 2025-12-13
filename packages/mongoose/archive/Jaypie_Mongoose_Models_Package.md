---
description: Document describes a Jaypie pattern repeated in many projects but not yet offered as a package within Jaypie
globs: packages/models/**
status: Work in Progress
---

# Jaypie Mongoose Models Package

Create reusable MongoDB models with rich relationship management using Mongoose and Jaypie.

## Goal

Define document schemas with bidirectional relationships and consistent utilities for mongoose models.

## Guidelines

- Uses ES modules with `.js` extensions (`"type": "module"`)
- Requires mongoose and jaypie as dependencies
- Follows schema organization pattern: definition → hooks → methods → statics → export
- Every schema should use `projectSchema.plugin.js` for relationship methods
- Every document has `uuid` field for external references

## Process

### Package Setup

1. Create package structure:
   ```
   models/
   ├── package.json
   ├── src/
   │   ├── constants.js
   │   ├── index.js
   │   ├── user.schema.js
   │   ├── projectSchema.plugin.js
   │   └── __tests__/
   │       ├── constants.spec.js
   │       ├── index.spec.js
   │       ├── user.schema.spec.js
   │       └── projectSchema.plugin.spec.js
   ├── testSetup.js
   └── vite.config.js
   ```

2. Configure package.json:
   ```json
   {
     "name": "@yournamespace/models",
     "type": "module",
     "exports": {
       ".": {
         "default": {
           "require": "./dist/module.cjs.js",
           "default": "./src/index.js"
         }
       }
     },
     "main": "src/index.js",
     "dependencies": {
       "jaypie": "^1.1.0",
       "mongoose": "^7.0.0"
     }
   }
   ```

### Core Files Implementation

1. projectSchema.plugin.js
   - Plugin providing relationship management methods
   - Key functions: allLeanByIds, allLeanByUuids, createWithRelationships, deleteWithRelationships, toJsonWithRelationships, updateWithRelationships
   - Utility functions: idsToUuids, uuidsToIds, oneByUuid, oneByXid

2. constants.ts
   ```typescript
   import { v5 as uuidv5 } from "uuid";

   const NAMESPACE_ROOT = "your-namespace-uuid";
   export const NAMESPACE = {
     USER: uuidv5("USER", NAMESPACE_ROOT),
   };

   export const SCHEMA = {
     USER: "user",
   };

   export default {
     NAMESPACE,
     SCHEMA,
   };
   ```

3. user.schema.ts
   ```typescript
   import { Schema } from "mongoose";
   import projectSchema from "./projectSchema.plugin.js";

   const schema = new Schema(
     {
       deletedAt: {
         type: Schema.Types.Date,
       },
       name: {
         type: Schema.Types.String,
       },
       uuid: {
         index: true,
         type: Schema.Types.String,
       },
       xid: {
         index: true,
         type: Schema.Types.String,
       },
     },
     { timestamps: true },
   );

   schema.plugin(projectSchema);

   export default schema;
   ```

4. index.ts
   ```typescript
   import { connect, disconnect, envsKey, log } from "jaypie";
   import mongoose, { Model, Schema } from "mongoose";
   import { SCHEMA } from "./constants.js";
   import userSchema from "./user.schema.js";

   let instantiatedModel: Record<string, Model<any>> | null;
   const { model } = mongoose;

   function getModel(name: string, schema: Schema): Model<any> {
     if (!instantiatedModel) {
       log.warn("[@yournamespace/models] Models have not been instantiated");
       instantiatedModel = {};
     }
     return instantiatedModel[name] || (instantiatedModel[name] = model(name, schema));
   }

   export default {
     connect: async (uri: string = envsKey("MONGODB_URI")) => {
       if (instantiatedModel) {
         log.warn("[@yournamespace/models] Models already instantiated");
       } else {
         instantiatedModel = {};
       }
       return uri ? mongoose.connect(uri) : connect();
     },
     disconnect: () => {
       instantiatedModel = null;
       return disconnect();
     },
     get User() {
       return getModel(SCHEMA.USER, userSchema);
     },
   };

   export { default as MODEL } from "./constants.js";
   ```

### Testing

1. vite.config.ts
   ```typescript
   import { defineConfig } from "vite";

   export default defineConfig({
     test: {
       globals: false,
       setupFiles: ["./testSetup.ts"],
     },
   });
   ```

2. testSetup.ts
   ```typescript
   import { beforeEach, vi } from "vitest";
   import mongoose from "mongoose";

   // Mock mongoose methods
   vi.mock("mongoose", async () => {
     const actual = await vi.importActual("mongoose");
     return {
       ...actual,
       connect: vi.fn().mockResolvedValue({}),
       disconnect: vi.fn().mockResolvedValue({}),
     };
   });

   // Reset mocks before each test
   beforeEach(() => {
     vi.clearAllMocks();
   });
   ```

### Usage

1. Connect to database:
   ```typescript
   import Model from "@yournamespace/models";

   await Model.connect();
   ```

2. Create document:
   ```typescript
   const user = await Model.User.createWithRelationships({
     uuid: "user-uuid",
     values: { name: "Test User" },
   });
   ```

3. Find document:
   ```typescript
   const user = await Model.User.oneByUuid("user-uuid");
   ```

4. Update with relationships:
   ```typescript
   await Model.User.updateWithRelationships({
     uuid: "user-uuid",
     values: { name: "Updated Name" },
   });
   ```

5. Delete with relationships:
   ```typescript
   await Model.User.deleteWithRelationships({
     uuid: "user-uuid",
   });
   ```