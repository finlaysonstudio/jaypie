# @jaypie/kit

Utility functions for Jaypie applications

## Installation

```bash
npm install @jaypie/kit
```

## Usage

### isProductionEnv

Checks if the application is running in a production environment.

Returns `true` if `PROJECT_ENV === "production"` OR `PROJECT_PRODUCTION === "true"`.

```typescript
import { isProductionEnv } from "@jaypie/kit";

if (isProductionEnv()) {
  console.log("Running in production");
}
```

### isNodeTestEnv

Checks if the application is running in a test environment.

Returns `true` if `NODE_ENV === "test"`.

```typescript
import { isNodeTestEnv } from "@jaypie/kit";

if (isNodeTestEnv()) {
  console.log("Running tests");
}
```

## License

MIT
