# Jaypie Types 🐦‍⬛🔣

Interface definitions for Jaypie, JSON:API, and utility types.

## 💿 Installation

```bash
npm install @jaypie/types
```

## 📋 Usage

```typescript
import { JsonApiResource, JsonApiResponse, JsonApiError } from "@jaypie/types";

// Create a JSON:API resource
const user: JsonApiResource = {
  id: "123",
  type: "users",
  attributes: {
    name: "John Doe",
    email: "john@example.com"
  },
  relationships: {
    posts: {
      data: [
        { id: "456", type: "posts" }
      ]
    }
  }
};

// Create a successful response with included resources
const successResponse: JsonApiResponse = {
  data: user,
  included: [
    {
      id: "456",
      type: "posts",
      attributes: {
        title: "Hello World"
      }
    }
  ],
  meta: {
    timestamp: new Date().toISOString()
  }
};

// Create an error response
const errorResponse: JsonApiResponse = {
  errors: [{
    status: "404",
    title: "Resource Not Found",
    detail: "The requested user could not be found",
    source: {
      pointer: "/data/attributes/user"
    }
  }]
};
```

## Types

### JSON Types
- `JsonValue` - Any valid JSON value (string, number, boolean, null, object, or array)
- `JsonObject` - A JSON object with string keys and JsonValue values
- `JsonArray` - An array of JSON objects
- `JsonReturn` - Either a JSON object or array
- `WithJsonFunction` - Interface for objects that can be serialized to JSON

### JSON:API Resource Types
- `JsonApiId` - String identifier for resources
- `JsonApiType` - String type for resources
- `JsonApiAttributes` - Object containing resource attributes
- `JsonApiRelationships` - Object defining resource relationships
- `JsonApiResource` - Complete JSON:API resource object

### JSON:API Response Types
- `JsonApiResponse` - Standard JSON:API response structure
- `JsonApiSingleResourceResponse` - Response containing a single resource
- `JsonApiCollectionResourceResponse` - Response containing an array of resources
- `JsonApiErrorResponse` - Response containing error information
- `JsonApiError` - Standard JSON:API error object

### Natural Schema Types
- `NaturalSchema` - A schema syntax that is self-describing
- `EmptyArray` - Type representing an empty array
- `EmptyObject` - Type representing an empty object

## 📜 License

[MIT License](./LICENSE.txt). Published by Finlayson Studio