# @jaypie/logger

Structured JSON logging utilities.

## Overview

`@jaypie/logger` provides structured JSON logging for Jaypie applications.

## Installation

```bash
npm install @jaypie/logger
```

## Key Features

### Structured Logging

JSON-formatted logs with multiple log levels:

```javascript
import { log } from "@jaypie/logger";

log.info("Application started");
log.error("An error occurred", { error });
log.debug("Debug information", { data });
```

### Log Levels

Supports standard log levels: trace, debug, info, warn, error, fatal.

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
