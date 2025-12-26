# @jaypie/types

Core TypeScript type definitions for the Jaypie framework.

## Purpose

This is a **types-only** package that provides shared type definitions used across the Jaypie ecosystem. It contains no runtime code—only TypeScript declaration files (`.d.ts`).

## Internal Structure

```
packages/types/
├── src/
│   └── index.d.ts      # All type definitions
├── dist/
│   └── index.d.ts      # Built output (bundled)
├── rollup.config.js    # Bundles .d.ts files
├── tsconfig.json
└── package.json
```

## Type Categories

### Scalar and JSON Types
- `ScalarValue` - Primitives: `boolean | null | number | string | undefined`
- `NaturalMap` - Object with string keys and scalar values
- `JsonValue` - Any valid JSON value (recursive)
- `JsonObject` - Object with string keys and JsonValue values
- `JsonArray` - Array of JSON values
- `JsonReturn` - `JsonArray | JsonObject`
- `AnyValue` - `JsonReturn | ScalarValue`
- `WithJsonFunction` - Interface with `json(): JsonReturn` method

### JSON:API Types
- `JsonApiId` - Resource identifier (string)
- `JsonApiType` - Resource type (string)
- `JsonApiAttributes` - Resource attributes object
- `JsonApiRelationships` - Resource relationships
- `JsonApiResource` - Complete resource with id, type, attributes, relationships

### JSON:API Response Types
- `JsonApiResponse` - Standard response (data, errors, included, meta, links)
- `JsonApiSingleResourceResponse` - Single resource response
- `JsonApiCollectionResourceResponse` - Array of resources response
- `JsonApiErrorResponse` - Error response with errors array
- `JsonApiError` - Error object (status, title, detail, source, etc.)

### Natural Schema Types
- `NaturalSchema` - Self-describing schema using constructors (`String`, `Number`, `Boolean`, `Object`, `Array`) or nested structures
- `NaturalSchemaObject` - Object with NaturalSchema values

## Usage in Other Packages

This package is used as a **devDependency** by:

| Package | Types Used |
|---------|------------|
| `@jaypie/errors` | `JsonApiError`, `JsonObject`, `JsonReturn` |
| `@jaypie/llm` | `JsonObject`, `NaturalSchema`, `JsonReturn`, `AnyValue`, `NaturalMap` |
| `@jaypie/textract` | `JsonReturn` |
| `@jaypie/testkit` | `JsonReturn` |

## Build

```bash
npm run build -w packages/types
```

Uses Rollup with `rollup-plugin-dts` to bundle TypeScript declarations.

## Adding New Types

1. Add type definitions to `src/index.d.ts`
2. Export the new types (all exports are in one file)
3. Run `npm run build -w packages/types`
4. Update dependent packages to use new types

## Notes

- No runtime code, no tests—this package only exports types
- All types are exported from a single entry point
- Uses `export type` for type-only exports
