# @jaypie/mongoose

MongoDB ODM integration with Mongoose.

## Overview

`@jaypie/mongoose` provides MongoDB integration using Mongoose ODM for Jaypie applications.

## Installation

```bash
npm install @jaypie/mongoose
```

## Key Features

### Connection Management

Lifecycle methods for MongoDB connections:

```javascript
import { connect, disconnect } from "@jaypie/mongoose";

// In handler setup phase
await connect();

// In handler teardown phase
await disconnect();
```

### Secret Integration

Automatic integration with AWS Secrets Manager for database credentials.

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/aws](./aws) - AWS integrations
